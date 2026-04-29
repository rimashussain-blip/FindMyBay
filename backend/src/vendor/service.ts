// Vendor queries — geospatial via raw SQL because Prisma doesn't support
// PostGIS types natively.

import { prisma } from '../config/db.js';
import { HttpError } from '../lib/error.js';

// ---------- /vendors/nearby ----------

export interface NearbyVendor {
  id: string;
  brandName: string;
  city: string;
  emirate: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  freeBays: number;
  rating: number | null;
  priceFromAed: number | null;
  logoUrl: string | null;
}

interface NearbyRow {
  id: string;
  brand_name: string;
  city: string;
  emirate: string;
  lat: number;
  lng: number;
  distance_meters: number;
  free_bays: number;
  rating_avg: number | null;
  price_from_aed: number | null;
  logo_url: string | null;
}

export async function findNearby(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<NearbyVendor[]> {
  const rows = await prisma.$queryRaw<NearbyRow[]>`
    SELECT
      v.id,
      v.brand_name,
      v.city,
      v.emirate::text AS emirate,
      v.lat,
      v.lng,
      ST_Distance(
        v.geom::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) AS distance_meters,
      v.rating_avg,
      v.price_from_aed,
      v.logo_url,
      COUNT(b.id) FILTER (WHERE b.status = 'free' AND b.deleted_at IS NULL) AS free_bays
    FROM vendors v
    LEFT JOIN bays b ON b.vendor_id = v.id
    WHERE v.status = 'active'
      AND v.deleted_at IS NULL
      AND ST_DWithin(
        v.geom::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    GROUP BY v.id
    HAVING COUNT(b.id) FILTER (WHERE b.status = 'free' AND b.deleted_at IS NULL) > 0
    ORDER BY distance_meters ASC
    LIMIT 50;
  `;

  return rows.map((r) => ({
    id: r.id,
    brandName: r.brand_name,
    city: r.city,
    emirate: r.emirate,
    lat: Number(r.lat),
    lng: Number(r.lng),
    distanceMeters: Number(r.distance_meters),
    freeBays: Number(r.free_bays),
    rating: r.rating_avg !== null ? Number(r.rating_avg) : null,
    priceFromAed: r.price_from_aed !== null ? Number(r.price_from_aed) : null,
    logoUrl: r.logo_url,
  }));
}

// ---------- /vendors/:id ----------

export interface VendorDetail {
  id: string;
  brandName: string;
  city: string;
  emirate: string;
  addressLine: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  priceFromAed: number | null;
  logoUrl: string | null;
  services: ServiceSummary[];
  bays: BaySummary[];
}

export interface ServiceSummary {
  id: string;
  name: string;
  durationMin: number;
  priceAed: number;
  vatInclusive: boolean;
}

export interface BaySummary {
  id: string;
  name: string;
  bayType: string;
  status: string;
}

export async function getVendorDetail(vendorId: string): Promise<VendorDetail> {
  const v = await prisma.vendor.findFirst({
    where: { id: vendorId, deletedAt: null, status: 'active' },
    include: {
      services: { where: { deletedAt: null }, orderBy: { priceAed: 'asc' } },
      bays: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
    },
  });
  if (!v) throw new HttpError(404, 'Vendor not found', { code: 'vendor_not_found' });

  return {
    id: v.id,
    brandName: v.brandName,
    city: v.city,
    emirate: String(v.emirate),
    addressLine: v.addressLine,
    lat: v.lat,
    lng: v.lng,
    rating: v.ratingAvg,
    priceFromAed: v.priceFromAed,
    logoUrl: v.logoUrl,
    services: v.services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.durationMin,
      priceAed: s.priceAed,
      vatInclusive: s.vatInclusive,
    })),
    bays: v.bays.map((b) => ({
      id: b.id,
      name: b.name,
      bayType: String(b.bayType),
      status: String(b.status),
    })),
  };
}

// ---------- /vendors/:id/availability ----------

export interface SlotsResponse {
  serviceId: string;
  serviceName: string;
  durationMin: number;
  date: string;
  slots: Slot[];
}

export interface Slot {
  startsAt: string;
  endsAt: string;
  available: boolean;
}

const SLOT_INTERVAL_MIN = 30;
const OPENING_HOUR = 8;
const CLOSING_HOUR = 22;

/**
 * Returns a 30-min slot grid for the given date and service.
 * A slot is "available" if at least one bay is free of conflicting bookings.
 */
export async function findAvailability(
  vendorId: string,
  serviceId: string,
  isoDate: string,
): Promise<SlotsResponse> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, vendorId, deletedAt: null },
  });
  if (!service)
    throw new HttpError(404, 'Service not found for this vendor', { code: 'service_not_found' });

  const bayCount = await prisma.bay.count({
    where: { vendorId, deletedAt: null, status: { not: 'closed' } },
  });
  if (bayCount === 0) {
    return {
      serviceId,
      serviceName: service.name,
      durationMin: service.durationMin,
      date: isoDate,
      slots: [],
    };
  }

  // UAE timezone (GMT+4, no DST).
  const dayStart = new Date(`${isoDate}T${String(OPENING_HOUR).padStart(2, '0')}:00:00+04:00`);
  const dayEnd = new Date(`${isoDate}T${String(CLOSING_HOUR).padStart(2, '0')}:00:00+04:00`);
  const now = new Date();
  const earliest = new Date(
    Math.ceil(now.getTime() / (SLOT_INTERVAL_MIN * 60_000)) * SLOT_INTERVAL_MIN * 60_000,
  );

  const dayBookings = await prisma.booking.findMany({
    where: {
      vendorId,
      slotStart: { gte: dayStart, lt: dayEnd },
      status: { in: ['confirmed', 'alert_scheduled', 'alerted', 'in_progress'] },
    },
    select: { bayId: true, slotStart: true, slotEnd: true },
  });

  const slots: Slot[] = [];
  for (
    let cursor = new Date(dayStart);
    cursor.getTime() + service.durationMin * 60_000 <= dayEnd.getTime();
    cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MIN * 60_000)
  ) {
    const slotEnd = new Date(cursor.getTime() + service.durationMin * 60_000);
    const isPast = cursor.getTime() < earliest.getTime();
    const conflicts = dayBookings.filter(
      (b) => b.slotStart < slotEnd && b.slotEnd > cursor,
    ).length;
    const available = !isPast && conflicts < bayCount;
    slots.push({
      startsAt: cursor.toISOString(),
      endsAt: slotEnd.toISOString(),
      available,
    });
  }

  return {
    serviceId,
    serviceName: service.name,
    durationMin: service.durationMin,
    date: isoDate,
    slots,
  };
}
