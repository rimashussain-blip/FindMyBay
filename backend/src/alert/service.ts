// Smart-alert scheduler & worker.
//
// Algorithm (architecture doc section 10):
//   1. When a booking is confirmed, schedule an alert at slot_start - 90 min.
//   2. Each tick: query Distance Matrix → leave_by = slot_start - travel - BUFFER.
//   3. If leave_by ≤ now, fire the push and mark the alert sent.
//   4. Otherwise reschedule the next probe — denser as we approach slot_start.
//
// Implementation: a single setInterval polls the alerts table every 30 seconds.
// For production we'd swap this for BullMQ delayed jobs; the polling worker is
// dead simple to operate and demonstrates the algorithm clearly for MVP.

import { prisma } from '../config/db.js';
import { logger } from '../lib/logger.js';
import { getMapsClient } from '../lib/maps.js';
import { getPushClient } from '../lib/push.js';

const BUFFER_SECONDS = 5 * 60;
const TICK_INTERVAL_MS = 30 * 1000;
const SCHEDULE_AHEAD_MS = 90 * 60 * 1000;
// A device location older than this is considered too stale to use; we fall
// back rather than computing an ETA from a coordinate the customer has
// long since left.
const LOCATION_FRESH_MS = 60 * 60 * 1000;
// Customer is "already at the vendor" if their reported location is within
// this radius. Triggers the geofence suppression — we skip Distance Matrix
// entirely and cancel the alert (per spec §10.4 cost-control).
const ARRIVED_RADIUS_M = 200;
// UAE-area "current" lat/lng used when we have no recent location for the
// customer (app never opened with permission, or last report > 60 min ago).
// Burj Khalifa as a sane Dubai-centric fallback.
const FALLBACK_LAT = 25.1972;
const FALLBACK_LNG = 55.2744;

/**
 * Called when a booking is created. Inserts an alerts row in 'scheduled' state.
 */
export async function scheduleAlertForBooking(bookingId: string, slotStart: Date) {
  const dueAt = new Date(slotStart.getTime() - SCHEDULE_AHEAD_MS);
  await prisma.alert.create({
    data: {
      bookingId,
      dueAt,
      etaMin: 0,
      status: 'scheduled',
    },
  });
  logger.info({ bookingId, dueAt }, 'alert scheduled');
}

/**
 * Process all alerts whose dueAt is now (or in the past) and not yet fired.
 * For each, compute leave_by; either fire or push the dueAt forward.
 */
export async function processDueAlerts(now = new Date()): Promise<{ processed: number; fired: number }> {
  const due = await prisma.alert.findMany({
    where: {
      status: { in: ['scheduled'] },
      dueAt: { lte: now },
    },
    take: 50,
    orderBy: { dueAt: 'asc' },
    include: {
      booking: {
        include: {
          vendor: true,
          customer: { include: { deviceTokens: true } },
          service: true,
        },
      },
    },
  });
  if (due.length === 0) return { processed: 0, fired: 0 };

  let fired = 0;
  for (const alert of due) {
    const b = alert.booking;
    if (!b || ['completed', 'cancelled', 'no_show'].includes(b.status)) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { status: 'cancelled' },
      });
      continue;
    }

    const origin = pickOrigin(b.customer);

    // Geofence suppression: if the customer is already within ARRIVED_RADIUS_M
    // of the vendor, there's nothing to alert about. Cancel the alert and
    // skip Distance Matrix entirely. Only applied to *reported* locations —
    // the Burj Khalifa fallback could happen to be near the vendor by chance
    // and we don't want to suppress on that.
    if (origin.source === 'reported') {
      const distM = haversineMeters(origin.lat, origin.lng, b.vendor.lat, b.vendor.lng);
      if (distM < ARRIVED_RADIUS_M) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: { status: 'cancelled', etaMin: 0 },
        });
        logger.info(
          { alertId: alert.id, bookingId: b.id, distM: Math.round(distM) },
          'alert suppressed (customer already at vendor)',
        );
        continue;
      }
    }

    const maps = getMapsClient();
    const estimate = await maps.estimate(origin.lat, origin.lng, b.vendor.lat, b.vendor.lng);
    const leaveBy = new Date(b.slotStart.getTime() - estimate.durationSeconds * 1000 - BUFFER_SECONDS * 1000);

    if (leaveBy.getTime() <= now.getTime()) {
      // It's time to leave. Fire the push.
      await fireAlert(alert.id, b, estimate.durationSeconds);
      fired++;
    } else {
      // Not yet — reschedule the next probe. Denser cadence as slot approaches.
      const minsToSlot = (b.slotStart.getTime() - now.getTime()) / 60_000;
      const cadenceMin = minsToSlot > 60 ? 30 : minsToSlot > 30 ? 15 : minsToSlot > 10 ? 5 : 1;
      const nextDue = new Date(now.getTime() + cadenceMin * 60_000);
      // Don't push past leave_by — we want the firing tick to happen on time.
      const cappedDue = nextDue.getTime() < leaveBy.getTime() ? nextDue : leaveBy;
      await prisma.alert.update({
        where: { id: alert.id },
        data: { dueAt: cappedDue, etaMin: Math.round(estimate.durationSeconds / 60) },
      });
      logger.debug(
        { alertId: alert.id, leaveBy, nextDue: cappedDue, etaMin: Math.round(estimate.durationSeconds / 60) },
        'alert probed',
      );
    }
  }

  return { processed: due.length, fired };
}

/**
 * Manually fire an alert immediately. Used by the test endpoint.
 */
export async function fireAlertNow(bookingId: string): Promise<{ fired: boolean; reason?: string }> {
  const alert = await prisma.alert.findFirst({
    where: { bookingId, status: 'scheduled' },
    include: {
      booking: {
        include: {
          vendor: true,
          customer: { include: { deviceTokens: true } },
          service: true,
        },
      },
    },
  });
  if (!alert) return { fired: false, reason: 'no scheduled alert for this booking' };

  const origin = pickOrigin(alert.booking.customer);

  // Same geofence guard as in the worker — don't waste a Distance Matrix
  // call (or push) if the customer is already at the vendor.
  if (origin.source === 'reported') {
    const distM = haversineMeters(
      origin.lat,
      origin.lng,
      alert.booking.vendor.lat,
      alert.booking.vendor.lng,
    );
    if (distM < ARRIVED_RADIUS_M) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { status: 'cancelled', etaMin: 0 },
      });
      logger.info(
        { alertId: alert.id, bookingId, distM: Math.round(distM) },
        'fireAlertNow suppressed (customer already at vendor)',
      );
      return { fired: false, reason: 'customer already at vendor' };
    }
  }

  const maps = getMapsClient();
  const estimate = await maps.estimate(
    origin.lat,
    origin.lng,
    alert.booking.vendor.lat,
    alert.booking.vendor.lng,
  );
  await fireAlert(alert.id, alert.booking, estimate.durationSeconds);
  return { fired: true };
}

/**
 * Great-circle distance in metres between two lat/lng pairs (haversine).
 * Used by the geofence suppression check.
 */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Pick the freshest origin coordinate available for the customer. Prefers
 * a location reported within the last hour; falls back to a stub Dubai
 * coordinate so the worker can still compute *some* ETA in dev when the
 * customer has never opened the app with location permission granted.
 */
function pickOrigin(customer: { lastLat: number | null; lastLng: number | null; lastLocationAt: Date | null }): {
  lat: number;
  lng: number;
  source: 'reported' | 'fallback';
} {
  if (
    customer.lastLat != null &&
    customer.lastLng != null &&
    customer.lastLocationAt &&
    Date.now() - customer.lastLocationAt.getTime() < LOCATION_FRESH_MS
  ) {
    return { lat: customer.lastLat, lng: customer.lastLng, source: 'reported' };
  }
  return { lat: FALLBACK_LAT, lng: FALLBACK_LNG, source: 'fallback' };
}

// ---------- Internals ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fireAlert(alertId: string, booking: any, etaSeconds: number) {
  const tokens = (booking.customer.deviceTokens as { fcmToken: string }[]).map((d) => d.fcmToken);
  const etaMin = Math.round(etaSeconds / 60);
  const push = getPushClient();
  await push.send(tokens, {
    title: 'Time to leave for your wash',
    body: `${booking.vendor.brandName} · ${etaMin} min away · slot at ${formatHm(booking.slotStart)}`,
    data: {
      kind: 'leave_now',
      bookingId: booking.id,
      vendorId: booking.vendor.id,
      etaMin: String(etaMin),
    },
  });
  await prisma.alert.update({
    where: { id: alertId },
    data: { status: 'fired', etaMin },
  });
  logger.info({ alertId, bookingId: booking.id, etaMin }, 'alert fired');
}

function formatHm(d: Date): string {
  // UAE local (GMT+4) HH:mm.
  const utcHour = d.getUTCHours();
  const uaeHour = (utcHour + 4) % 24;
  return `${String(uaeHour).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// ---------- Worker loop ----------

let intervalHandle: NodeJS.Timeout | null = null;

export function startAlertWorker() {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    processDueAlerts()
      .then((r) => {
        if (r.processed > 0) logger.debug(r, 'alert tick');
      })
      .catch((err) => logger.error({ err }, 'alert tick failed'));
  }, TICK_INTERVAL_MS);
  logger.info({ intervalMs: TICK_INTERVAL_MS }, '🔔 alert worker started');
}

export function stopAlertWorker() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}
