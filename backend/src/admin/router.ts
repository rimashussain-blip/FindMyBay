// Vendor admin endpoints — used by the React vendor admin SPA.
//
// All routes require requireAuth + requireVendor. The vendor's id comes from
// the vendor_members join, not from a path param, so vendors can only ever
// see and modify their own data.

import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { asyncHandler, HttpError } from '../lib/error.js';
import { requireAuth } from '../auth/middleware.js';
import { requireVendor } from './middleware.js';
import { parseQrString, verifyCheckinToken } from '../booking/qr.js';
import { logger } from '../lib/logger.js';
import { emitBayUpdate, emitBookingStatus, emitVendorBookingChanged } from '../realtime/server.js';
import { sendWashCompletePush } from '../notify/washComplete.js';
import { priceLineFromService } from '../lib/vat.js';
import { assignInvoiceNumber } from '../lib/invoice.js';
import { loadLoyaltyForCustomers } from '../lib/loyalty.js';

export const adminRouter = Router();

// ── Brand ────────────────────────────────────────────────────────────────

adminRouter.get(
  '/me',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUniqueOrThrow({
      where: { id: req.vendor!.id },
      include: {
        bays: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
        services: { where: { deletedAt: null }, orderBy: { priceAed: 'asc' } },
      },
    });
    res.json({
      vendor: {
        id: vendor.id,
        brandName: vendor.brandName,
        status: String(vendor.status),
        city: vendor.city,
        emirate: String(vendor.emirate),
        addressLine: vendor.addressLine,
        tradeLicenseNo: vendor.tradeLicenseNo,
        trnNumber: vendor.trnNumber,
        lat: vendor.lat,
        lng: vendor.lng,
        logoUrl: vendor.logoUrl,
        hours: vendor.hours,
        ratingAvg: vendor.ratingAvg,
        priceFromAed: vendor.priceFromAed,
        bays: vendor.bays.map((b) => ({
          id: b.id,
          name: b.name,
          bayType: String(b.bayType),
          status: String(b.status),
        })),
        services: vendor.services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMin: s.durationMin,
          priceAed: s.priceAed,
          vatInclusive: s.vatInclusive,
        })),
      },
      role: req.vendor!.role,
    });
  }),
);

// Hours shape: { mon: { open: "08:00", close: "22:00" } | null, ... }
const HHMM = z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:mm');
const dayHoursSchema = z
  .object({ open: HHMM, close: HHMM })
  .nullable();
const hoursSchema = z
  .object({
    mon: dayHoursSchema.optional(),
    tue: dayHoursSchema.optional(),
    wed: dayHoursSchema.optional(),
    thu: dayHoursSchema.optional(),
    fri: dayHoursSchema.optional(),
    sat: dayHoursSchema.optional(),
    sun: dayHoursSchema.optional(),
  })
  .strict();

const updateBrandBody = z.object({
  brandName: z.string().min(1).max(120).optional(),
  addressLine: z.string().max(200).nullable().optional(),
  tradeLicenseNo: z.string().max(80).nullable().optional(),
  // UAE Tax Registration Number — 15 digits exactly per FTA. Accept any
  // string up to 20 chars so we don't reject inputs with hyphens/spaces;
  // surface a friendlier error than zod's default when format is wrong.
  trnNumber: z.string().max(20).nullable().optional(),
  city: z.string().min(1).max(80).optional(),
  emirate: z.enum(['AbuDhabi', 'Dubai', 'Sharjah', 'Ajman', 'UmmAlQuwain', 'RasAlKhaimah', 'Fujairah']).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  logoUrl: z.string().url().nullable().optional(),
  hours: hoursSchema.nullable().optional(),
});

/**
 * PATCH /admin/me/vendor
 *
 * Vendor owner edits their own brand info. Manager/attendant can't change
 * brand-level fields. If lat/lng changes, we re-write the PostGIS geom.
 */
adminRouter.patch(
  '/me/vendor',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const body = updateBrandBody.parse(req.body);
    const vendorId = req.vendor!.id;

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({
        where: { id: vendorId },
        // Prisma needs the special JsonNull token to clear a JSON column;
        // passing a JS null hits a type error.
        data: {
          ...body,
          hours:
            body.hours === undefined
              ? undefined
              : body.hours === null
                ? Prisma.JsonNull
                : (body.hours as Prisma.InputJsonValue),
        },
      });
      if (body.lat !== undefined || body.lng !== undefined) {
        await tx.$executeRaw`
          UPDATE vendors
             SET geom = ST_SetSRID(ST_MakePoint(${v.lng}, ${v.lat}), 4326)
           WHERE id = ${vendorId}
        `;
      }
      return v;
    });

    res.json({
      id: updated.id,
      brandName: updated.brandName,
      status: String(updated.status),
      city: updated.city,
      emirate: String(updated.emirate),
      addressLine: updated.addressLine,
      tradeLicenseNo: updated.tradeLicenseNo,
      trnNumber: updated.trnNumber,
      lat: updated.lat,
      lng: updated.lng,
      logoUrl: updated.logoUrl,
      hours: updated.hours,
    });
  }),
);

// ── Bays ──────────────────────────────────────────────────────────────────

const bayStatusBody = z.object({ status: z.enum(['free', 'busy', 'closed']) });

adminRouter.patch(
  '/bays/:id/status',
  requireAuth,
  requireVendor('owner', 'manager', 'attendant'),
  asyncHandler(async (req, res) => {
    const { status } = bayStatusBody.parse(req.body);
    const bay = await prisma.bay.findUnique({ where: { id: req.params.id } });
    if (!bay || bay.vendorId !== req.vendor!.id) {
      throw new HttpError(404, 'Bay not found', { code: 'bay_not_found' });
    }
    const updated = await prisma.bay.update({
      where: { id: bay.id },
      data: { status },
    });
    void emitBayUpdate(req.vendor!.id, updated.id, updated.status);
    res.json({ id: updated.id, status: String(updated.status) });
  }),
);

const newBayBody = z.object({
  name: z.string().min(1).max(50),
  bayType: z.enum(['sedan', 'suv', 'bike']).default('sedan'),
});

adminRouter.post(
  '/bays',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const { name, bayType } = newBayBody.parse(req.body);
    const bay = await prisma.bay.create({
      data: { vendorId: req.vendor!.id, name, bayType, status: 'free' },
    });
    res.status(201).json({ id: bay.id, name: bay.name, bayType: String(bay.bayType), status: String(bay.status) });
  }),
);

// ── Services ──────────────────────────────────────────────────────────────

const serviceBody = z.object({
  name: z.string().min(1).max(80),
  durationMin: z.number().int().min(5).max(360),
  priceAed: z.number().int().min(0).max(10_000),
  vatInclusive: z.boolean().default(true),
});

adminRouter.post(
  '/services',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = serviceBody.parse(req.body);
    const svc = await prisma.service.create({
      data: { ...body, vendorId: req.vendor!.id },
    });
    res.status(201).json(svc);
  }),
);

adminRouter.patch(
  '/services/:id',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = serviceBody.partial().parse(req.body);
    const svc = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!svc || svc.vendorId !== req.vendor!.id)
      throw new HttpError(404, 'Service not found', { code: 'service_not_found' });
    const updated = await prisma.service.update({
      where: { id: svc.id },
      data: body,
    });
    res.json(updated);
  }),
);

adminRouter.delete(
  '/services/:id',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const svc = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!svc || svc.vendorId !== req.vendor!.id)
      throw new HttpError(404, 'Service not found', { code: 'service_not_found' });
    await prisma.service.update({
      where: { id: svc.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

// ── Bookings pipeline ─────────────────────────────────────────────────────

adminRouter.get(
  '/bookings/today',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    // Show today + the next 7 days. The page is still labelled "Today" in the
    // UI but the wider window makes the dev demo flow practical: vendors can
    // mark upcoming bookings as completed, customers can book ahead, etc.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfWindow = new Date(startOfDay);
    endOfWindow.setDate(endOfWindow.getDate() + 7);

    const bookings = await prisma.booking.findMany({
      where: {
        vendorId: req.vendor!.id,
        slotStart: { gte: startOfDay, lt: endOfWindow },
      },
      orderBy: { slotStart: 'asc' },
      include: {
        customer: { select: { id: true, phone: true, fullName: true, carMake: true, carType: true, carColor: true, carPlate: true } },
        service: { select: { id: true, name: true, durationMin: true, priceAed: true } },
        bay: { select: { id: true, name: true } },
      },
    });

    // Loyalty: fetch tiers for every registered customer in one batch.
    // Walk-ins (customerId=null) are skipped — they always render as
    // first-time / Bronze in the UI.
    const customerIds = bookings
      .map((b) => b.customer?.id)
      .filter((id): id is string => !!id);
    const loyaltyById = await loadLoyaltyForCustomers(customerIds, req.vendor!.id);

    res.json({
      items: bookings.map((b) => ({
        id: b.id,
        status: String(b.status),
        slotStart: b.slotStart.toISOString(),
        slotEnd: b.slotEnd.toISOString(),
        totalAed: b.totalAed,
        vatAed: b.vatAed,
        invoiceNumber: b.invoiceNumber,
        isWalkIn: b.isWalkIn,
        // For registered customers we surface their User row + loyalty
        // tier (computed from completed-booking history). Walk-ins use
        // whatever name/phone staff captured at the desk and stay
        // tier-less (the SPA renders no badge for those).
        customer: b.customer
          ? {
              id: b.customer.id,
              phone: b.customer.phone,
              fullName: b.customer.fullName,
              loyalty: loyaltyById.get(b.customer.id) ?? null,
            }
          : {
              id: null,
              phone: b.walkInPhone,
              fullName: b.walkInName,
              loyalty: null,
            },
        service: b.service,
        bay: b.bay,
      })),
    });
  }),
);

// ── Walk-in entry ────────────────────────────────────────────────────────
//
// Vendor staff records a customer who showed up without an advance booking.
// Creates a Booking row with isWalkIn=true, customerId=null, status='in_progress',
// slot starting now. Bay is flipped to busy. No payment row in V1 (cash/in-
// person handled off-platform). Same downstream flow as a checked-in
// reservation: when the wash is done, vendor marks status='completed',
// which releases the bay and counts toward the dashboard's revenue.

const walkInBody = z.object({
  bayId: z.string().min(1),
  serviceId: z.string().min(1),
  walkInName: z.string().trim().min(1).max(80).optional(),
  walkInPhone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone').optional(),
  // Optional slotStart (ISO datetime). When omitted, slot starts now. When
  // provided (vendor staff picks a future time on the walk-in calendar),
  // we snap to the start of the minute and check the slot is free.
  slotStart: z.string().datetime().optional(),
});

adminRouter.post(
  '/walk-in',
  requireAuth,
  requireVendor('owner', 'manager', 'attendant'),
  asyncHandler(async (req, res) => {
    const body = walkInBody.parse(req.body);
    const vendorId = req.vendor!.id;

    // Validate bay + service belong to this vendor before any writes — keeps
    // cross-tenant access impossible by construction.
    const [bay, service] = await Promise.all([
      prisma.bay.findUnique({ where: { id: body.bayId } }),
      prisma.service.findUnique({ where: { id: body.serviceId } }),
    ]);
    if (!bay || bay.vendorId !== vendorId || bay.deletedAt) {
      throw new HttpError(404, 'Bay not found', { code: 'bay_not_found' });
    }
    if (!service || service.vendorId !== vendorId || service.deletedAt) {
      throw new HttpError(404, 'Service not found', { code: 'service_not_found' });
    }
    if (bay.status === 'closed') {
      throw new HttpError(409, 'Bay is closed', { code: 'bay_closed' });
    }

    // Resolve the slot. If the staff picked a slot from the calendar, honour
    // it; otherwise default to "right now" (rounded to the minute).
    const slotStart = body.slotStart ? new Date(body.slotStart) : new Date();
    slotStart.setSeconds(0, 0);
    const slotEnd = new Date(slotStart.getTime() + service.durationMin * 60_000);
    const now = new Date();
    // Treat anything within the current 30-min window as "now" for the
    // bay-busy check below.
    const isStartingNow = slotStart.getTime() <= now.getTime() + 60_000;

    // Conflict check: any existing live booking on this bay overlapping
    // the requested window blocks the walk-in. Same status filter as the
    // customer-facing availability search.
    const conflict = await prisma.booking.findFirst({
      where: {
        bayId: bay.id,
        status: { in: ['confirmed', 'alert_scheduled', 'alerted', 'in_progress'] },
        slotStart: { lt: slotEnd },
        slotEnd: { gt: slotStart },
      },
      select: { id: true, slotStart: true, slotEnd: true },
    });
    if (conflict) {
      throw new HttpError(409, 'That bay/slot is already booked', { code: 'slot_taken' });
    }

    // For "now" walk-ins also reject if the bay is currently flagged busy
    // by the bay board (e.g. closed manually). Future-slot walk-ins skip
    // this — the bay can be busy now and still free at the chosen slot.
    if (isStartingNow && bay.status === 'busy') {
      throw new HttpError(409, 'Bay is currently busy', { code: 'bay_busy' });
    }

    // Walk-ins that start in the future are 'confirmed' so they show on
    // the bay-board / day timeline but don't immediately flip the bay to
    // busy. Walk-ins that start now go straight to 'in_progress' and the
    // bay flips to busy.
    const initialStatus = isStartingNow ? 'in_progress' : 'confirmed';

    const { totalAed, vatAed } = priceLineFromService(service.priceAed, service.vatInclusive);
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          vendorId,
          bayId: bay.id,
          serviceId: service.id,
          slotStart,
          slotEnd,
          status: initialStatus,
          totalAed,
          vatAed,
          isWalkIn: true,
          walkInName: body.walkInName ?? null,
          walkInPhone: body.walkInPhone ?? null,
          // customerId stays null
        },
      });
      // Walk-ins are paid in cash at the desk — assign the FTA invoice
      // number immediately so the staff can print/quote a compliant
      // receipt before the customer leaves.
      await assignInvoiceNumber(tx, vendorId, booking.id);
      if (isStartingNow) {
        await tx.bay.update({ where: { id: bay.id }, data: { status: 'busy' } });
      }
      return booking;
    });

    if (isStartingNow) void emitBayUpdate(vendorId, bay.id, 'busy');
    emitVendorBookingChanged(vendorId, result.id, String(result.status));

    logger.info(
      {
        bookingId: result.id,
        vendorId,
        bayId: bay.id,
        serviceId: service.id,
        walkInName: body.walkInName,
      },
      'walk-in recorded',
    );

    res.status(201).json({
      id: result.id,
      status: String(result.status),
      slotStart: result.slotStart.toISOString(),
      slotEnd: result.slotEnd.toISOString(),
      totalAed: result.totalAed,
      vatAed: result.vatAed,
      invoiceNumber: result.invoiceNumber,
      isWalkIn: true,
      customer: { id: null, phone: result.walkInPhone, fullName: result.walkInName },
      bay: { id: bay.id, name: bay.name },
      service: { id: service.id, name: service.name, durationMin: service.durationMin, priceAed: service.priceAed },
    });
  }),
);

// ── Availability calendar (walk-in scheduler) ───────────────────────────
//
// Returns the requested day's bays + services + already-booked windows so
// the SPA can render a bay × time grid and let staff click an empty cell
// to start a walk-in. Bookings include both customer-app reservations and
// prior walk-ins so the same cell never shows as "available" twice.
//
// Date is optional — defaults to today (UAE local). The SPA passes
// `?date=YYYY-MM-DD` when the staff navigates the day picker.
//
// Frontend should subscribe to socket.io `booking:changed` events and
// refetch this endpoint on any status change so newly-booked cells fall
// off immediately.

const availabilityQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
});

adminRouter.get(
  '/availability',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const { date } = availabilityQuery.parse(req.query);

    // Day window. UAE timezone (GMT+4, no DST). Default = today (UAE).
    const targetIso = date ?? new Date(new Date().getTime() + 4 * 3600_000).toISOString().slice(0, 10);
    const dayStart = new Date(`${targetIso}T00:00:00+04:00`);
    const dayEnd = new Date(`${targetIso}T23:59:59+04:00`);

    const [vendor, bookings] = await Promise.all([
      prisma.vendor.findUniqueOrThrow({
        where: { id: vendorId },
        include: {
          bays: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
          services: { where: { deletedAt: null }, orderBy: { priceAed: 'asc' } },
        },
      }),
      prisma.booking.findMany({
        where: {
          vendorId,
          slotStart: { gte: dayStart, lt: dayEnd },
          status: { in: ['confirmed', 'alert_scheduled', 'alerted', 'in_progress'] },
        },
        select: {
          id: true,
          bayId: true,
          slotStart: true,
          slotEnd: true,
          status: true,
          totalAed: true,
          vatAed: true,
          invoiceNumber: true,
          isWalkIn: true,
          walkInName: true,
          walkInPhone: true,
          // Customer detail block — surfaced on the hover/click customer
          // card in the walk-in scheduler so the attendant sees the plate
          // they're expecting without leaving the page. Walk-ins don't have
          // a customer row (customer = null) and we don't capture car details
          // for them either; those fall back to null on the response.
          customer: {
            select: {
              fullName: true,
              phone: true,
              carMake: true,
              carType: true,
              carColor: true,
              carPlate: true,
            },
          },
          service: { select: { name: true } },
          // Pull the most-recent Payment row so the SPA can render
          // "paid" vs "unpaid" on the slot pill. Walk-ins have no Payment
          // row (paid in person), which the SPA renders as "cash".
          payments: {
            select: { status: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { slotStart: 'asc' },
      }),
    ]);

    res.json({
      // SPA renders the grid based on these constants. They mirror the
      // customer-app slot search in `vendor/service.ts`.
      date: targetIso,
      openingHour: 8,
      closingHour: 22,
      intervalMin: 30,
      bays: vendor.bays.map((b) => ({
        id: b.id,
        name: b.name,
        bayType: String(b.bayType),
        status: String(b.status),
      })),
      services: vendor.services.map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        priceAed: s.priceAed,
      })),
      // One row per existing booking for the day. The grid renders these as
      // greyed-out blocks spanning [slotStart, slotEnd) on the bay's column.
      bookings: bookings.map((b) => ({
        id: b.id,
        bayId: b.bayId,
        slotStart: b.slotStart.toISOString(),
        slotEnd: b.slotEnd.toISOString(),
        status: String(b.status),
        totalAed: b.totalAed,
        vatAed: b.vatAed,
        invoiceNumber: b.invoiceNumber,
        isWalkIn: b.isWalkIn,
        customerName: b.customer?.fullName ?? b.walkInName ?? null,
        // Phone + car details for the hover/click customer card. Walk-ins
        // surface whatever phone the staff captured at the desk; car
        // details stay null because we don't capture them in V1.
        customerPhone: b.customer?.phone ?? b.walkInPhone ?? null,
        carMake: b.customer?.carMake ?? null,
        carType: b.customer?.carType ? String(b.customer.carType) : null,
        carColor: b.customer?.carColor ?? null,
        carPlate: b.customer?.carPlate ?? null,
        serviceName: b.service.name,
        // Walk-ins are paid in person and have no Payment row in V1 →
        // 'cash'. App bookings reflect their latest Payment row's status,
        // collapsed into a binary 'paid' / 'unpaid' for the slot pill.
        paymentMethod: b.isWalkIn
          ? ('cash' as const)
          : b.payments[0]?.status === 'succeeded'
            ? ('paid' as const)
            : ('unpaid' as const),
      })),
    });
  }),
);

const updateStatusBody = z.object({
  status: z.enum(['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
});

adminRouter.patch(
  '/bookings/:id/status',
  requireAuth,
  requireVendor('owner', 'manager', 'attendant'),
  asyncHandler(async (req, res) => {
    const { status } = updateStatusBody.parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking || booking.vendorId !== req.vendor!.id)
      throw new HttpError(404, 'Booking not found', { code: 'booking_not_found' });

    // Terminal statuses release the bay back to `free` so it's bookable again.
    const releasesBay = ['completed', 'cancelled', 'no_show'].includes(status);

    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.booking.update({
        where: { id: booking.id },
        data: { status },
      });

      let bayFlipped: { id: string; status: 'free' | 'busy' | 'closed' } | null = null;
      if (releasesBay) {
        const bay = await tx.bay.findUnique({ where: { id: booking.bayId } });
        // Only flip from busy → free; don't override a manually-closed bay.
        if (bay?.status === 'busy') {
          await tx.bay.update({ where: { id: bay.id }, data: { status: 'free' } });
          bayFlipped = { id: bay.id, status: 'free' };
        }
      }
      return { booking: u, bayFlipped };
    });

    if (result.bayFlipped) {
      void emitBayUpdate(req.vendor!.id, result.bayFlipped.id, result.bayFlipped.status);
    }
    emitBookingStatus(booking.customerId, result.booking.id, String(result.booking.status));
    emitVendorBookingChanged(req.vendor!.id, result.booking.id, String(result.booking.status));

    // "Your car is fresh & ready" push lands when the booking is marked completed.
    if (status === 'completed' && booking.status !== 'completed') {
      void sendWashCompletePush(result.booking.id);
    }

    res.json({ id: result.booking.id, status: String(result.booking.status) });
  }),
);

// ── QR check-in ──────────────────────────────────────────────────────────

const checkinBody = z.object({ qr: z.string().min(20) });

/**
 * POST /admin/checkin
 * Vendor staff scans the customer's QR. We verify the JWT signature, ensure
 * the booking belongs to the scanning vendor, and atomically transition the
 * booking to in_progress + flip the bay to busy.
 */
adminRouter.post(
  '/checkin',
  requireAuth,
  requireVendor('owner', 'manager', 'attendant'),
  asyncHandler(async (req, res) => {
    const { qr } = checkinBody.parse(req.body);
    const parsed = parseQrString(qr);
    if (!parsed) throw new HttpError(400, 'QR is malformed', { code: 'qr_malformed' });

    let claims;
    try {
      claims = verifyCheckinToken(parsed.token);
    } catch (err: unknown) {
      const isExpired = (err as Error)?.name === 'TokenExpiredError';
      throw new HttpError(
        400,
        isExpired ? 'QR has expired (booking window closed)' : 'QR signature is invalid',
        { code: isExpired ? 'qr_expired' : 'qr_invalid' },
      );
    }

    if (claims.bookingId !== parsed.bookingId) {
      throw new HttpError(400, 'QR booking ID mismatch', { code: 'qr_mismatch' });
    }
    if (claims.vendorId !== req.vendor!.id) {
      throw new HttpError(403, "This booking belongs to a different vendor", {
        code: 'wrong_vendor',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: claims.bookingId },
        include: {
          customer: { select: { id: true, phone: true, fullName: true, carMake: true, carType: true, carColor: true, carPlate: true } },
          service: { select: { id: true, name: true, durationMin: true } },
          bay: { select: { id: true, name: true } },
        },
      });
      if (!booking) throw new HttpError(404, 'Booking not found');
      if (booking.vendorId !== req.vendor!.id) throw new HttpError(403, 'Wrong vendor');

      if (booking.status === 'in_progress') {
        // Idempotent: scanning twice is fine.
        return { booking, alreadyChecked: true };
      }
      if (!['confirmed', 'alert_scheduled', 'alerted'].includes(booking.status)) {
        throw new HttpError(409, `Booking is ${booking.status}; can't check in`, {
          code: 'wrong_status',
        });
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'in_progress' },
        include: {
          customer: { select: { id: true, phone: true, fullName: true, carMake: true, carType: true, carColor: true, carPlate: true } },
          service: { select: { id: true, name: true, durationMin: true } },
          bay: { select: { id: true, name: true } },
        },
      });
      // Flip the bay to busy too.
      await tx.bay.update({ where: { id: booking.bayId }, data: { status: 'busy' } });

      return { booking: updated, alreadyChecked: false };
    });

    if (!result.alreadyChecked) {
      void emitBayUpdate(req.vendor!.id, result.booking.bayId, 'busy');
      // emitBookingStatus is null-safe — silently skips for walk-ins.
      emitBookingStatus(result.booking.customerId, result.booking.id, 'in_progress');
      emitVendorBookingChanged(req.vendor!.id, result.booking.id, 'in_progress');
    }

    logger.info(
      {
        bookingId: result.booking.id,
        bayId: result.booking.bayId,
        already: result.alreadyChecked,
      },
      'check-in via QR',
    );

    res.json({
      ok: true,
      alreadyCheckedIn: result.alreadyChecked,
      booking: {
        id: result.booking.id,
        status: String(result.booking.status),
        slotStart: result.booking.slotStart.toISOString(),
        customer: result.booking.customer,
        service: result.booking.service,
        bay: result.booking.bay,
      },
    });
  }),
);

// ── Manual short-code check-in (fallback for QR-can't-scan situations) ──

const codeBody = z.object({ code: z.string().min(4).max(8) });

/**
 * POST /admin/checkin/code
 * Vendor staff types in the customer's 4-character "FMB-XXXX" booking suffix.
 * We resolve the short code to a booking belonging to this vendor with a
 * scannable status, then transition exactly like the QR flow.
 */
adminRouter.post(
  '/checkin/code',
  requireAuth,
  requireVendor('owner', 'manager', 'attendant'),
  asyncHandler(async (req, res) => {
    const { code } = codeBody.parse(req.body);
    const suffix = code.replace(/^FMB-?/i, '').toLowerCase();
    if (suffix.length < 4) throw new HttpError(400, 'Code is too short', { code: 'code_short' });

    const candidates = await prisma.booking.findMany({
      where: {
        vendorId: req.vendor!.id,
        status: { in: ['confirmed', 'alert_scheduled', 'alerted', 'in_progress'] },
      },
      orderBy: { slotStart: 'asc' },
      include: {
        customer: { select: { id: true, phone: true, fullName: true, carMake: true, carType: true, carColor: true, carPlate: true } },
        service: { select: { id: true, name: true, durationMin: true } },
        bay: { select: { id: true, name: true } },
      },
    });

    const match = candidates.find((b) => b.id.toLowerCase().endsWith(suffix));
    if (!match) {
      throw new HttpError(404, 'No active booking found for that code', { code: 'no_match' });
    }

    if (match.status === 'in_progress') {
      return res.json({
        ok: true,
        alreadyCheckedIn: true,
        booking: {
          id: match.id,
          status: String(match.status),
          slotStart: match.slotStart.toISOString(),
          customer: match.customer,
          service: match.service,
          bay: match.bay,
        },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.booking.update({
        where: { id: match.id },
        data: { status: 'in_progress' },
        include: {
          customer: { select: { id: true, phone: true, fullName: true, carMake: true, carType: true, carColor: true, carPlate: true } },
          service: { select: { id: true, name: true, durationMin: true } },
          bay: { select: { id: true, name: true } },
        },
      });
      await tx.bay.update({ where: { id: match.bayId }, data: { status: 'busy' } });
      return u;
    });

    void emitBayUpdate(req.vendor!.id, updated.bayId, 'busy');
    emitBookingStatus(updated.customerId, updated.id, 'in_progress');
    emitVendorBookingChanged(req.vendor!.id, updated.id, 'in_progress');
    logger.info({ bookingId: updated.id, code: suffix }, 'check-in via short code');

    return res.json({
      ok: true,
      alreadyCheckedIn: false,
      booking: {
        id: updated.id,
        status: String(updated.status),
        slotStart: updated.slotStart.toISOString(),
        customer: updated.customer,
        service: updated.service,
        bay: updated.bay,
      },
    });
  }),
);

// ── Reviews (vendor side) ────────────────────────────────────────────────

/**
 * GET /admin/reviews
 * Lists reviews for the calling vendor, newest first.
 */
adminRouter.get(
  '/reviews',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { vendorId: req.vendor!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        booking: {
          select: {
            id: true,
            slotStart: true,
            service: { select: { name: true } },
            customer: { select: { fullName: true, phone: true } },
          },
        },
      },
    });

    const agg = await prisma.review.aggregate({
      where: { vendorId: req.vendor!.id },
      _avg: { rating: true },
      _count: { _all: true },
    });

    res.json({
      summary: {
        ratingAvg: agg._avg.rating,
        count: agg._count._all,
      },
      items: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        bookingId: r.bookingId,
        slotStart: r.booking.slotStart.toISOString(),
        serviceName: r.booking.service.name,
        // Walk-ins can't leave reviews in V1 (no app session, no review screen)
        // so r.booking.customer is effectively always present here. Defensive
        // fallback in case a walk-in is ever wired into the review flow.
        customerName:
          r.booking.customer?.fullName ?? maskPhone(r.booking.customer?.phone ?? null),
      })),
    });
  }),
);

function maskPhone(phone: string | null): string {
  if (!phone) return 'Customer';
  const last4 = phone.slice(-4);
  return `Customer ···${last4}`;
}

// ── Dashboard analytics ──────────────────────────────────────────────────

const dashboardQuery = z.object({
  // Optional ISO dates. Default = trailing 30 days ending today (vendor's
  // local clock, but we treat it as UTC for the cutoff — close enough for
  // an MVP dashboard).
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * GET /admin/dashboard
 *
 * Vendor-side analytics. Aggregates COMPLETED bookings only — pending /
 * cancelled / no-show are excluded so revenue and time figures match what
 * the operator actually delivered.
 *
 * Response shape (kept stable for the SPA):
 *   summary:     KPI cards (totals, averages)
 *   byService:   per-service breakdown (count, revenue, avg duration)
 *   byDay:       last-N-days time series for charting (count + revenue)
 *
 * Authorisation: any vendor role can read their own vendor's dashboard;
 * the vendor id comes from the requireVendor() join, never from a query
 * param, so cross-tenant reads are impossible by construction.
 */
adminRouter.get(
  '/dashboard',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const { from, to } = dashboardQuery.parse(req.query);

    const now = new Date();
    const toDate = to ? new Date(to) : now;
    // Default window = trailing 30 days. Trim to start-of-day for `from` so
    // the daily bucket math doesn't drop the first calendar day.
    const fromDate = from
      ? new Date(from)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const vendorId = req.vendor!.id;
    const where = {
      vendorId,
      status: 'completed' as const,
      slotStart: { gte: fromDate, lte: toDate },
    };

    // ── 1. Summary KPIs ─────────────────────────────────────────────────
    const totals = await prisma.booking.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalAed: true },
    });

    // Duration comes from the joined Service. We pull serviceId+totals at
    // the same time we compute the per-service breakdown to avoid two
    // round trips.
    const groupedByService = await prisma.booking.groupBy({
      by: ['serviceId'],
      where,
      _count: { _all: true },
      _sum: { totalAed: true },
    });

    const serviceIds = groupedByService.map((g) => g.serviceId);
    const services = serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, durationMin: true },
        })
      : [];
    const serviceById = new Map(services.map((s) => [s.id, s]));

    const byService = groupedByService.map((g) => {
      const svc = serviceById.get(g.serviceId);
      const count = g._count._all;
      const revenue = g._sum.totalAed ?? 0;
      const durationMin = svc?.durationMin ?? 0;
      return {
        serviceId: g.serviceId,
        name: svc?.name ?? 'Unknown service',
        count,
        revenueAed: revenue,
        durationMinPerWash: durationMin,
        totalDurationMin: durationMin * count,
        avgRevenuePerWashAed: count > 0 ? Math.round((revenue / count) * 100) / 100 : 0,
      };
    });

    const totalBookings = totals._count._all;
    const totalRevenueAed = totals._sum.totalAed ?? 0;
    const totalDurationMin = byService.reduce((sum, s) => sum + s.totalDurationMin, 0);
    const summary = {
      totalBookings,
      totalRevenueAed,
      totalDurationMin,
      avgRevenuePerBookingAed:
        totalBookings > 0 ? Math.round((totalRevenueAed / totalBookings) * 100) / 100 : 0,
      avgDurationMin:
        totalBookings > 0 ? Math.round(totalDurationMin / totalBookings) : 0,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    };

    // ── 2. Per-day breakdown for charting ───────────────────────────────
    // Postgres date_trunc by day gives us a clean daily bucket. We use
    // raw SQL because Prisma's groupBy can't truncate timestamps. The
    // query is parameterised so vendorId can't leak.
    const daily = await prisma.$queryRaw<
      Array<{ day: Date; count: bigint; revenue: number | null }>
    >`
      SELECT
        date_trunc('day', "slot_start") AS day,
        COUNT(*)::bigint AS count,
        COALESCE(SUM("total_aed"), 0)::int AS revenue
      FROM "bookings"
      WHERE "vendor_id" = ${vendorId}
        AND "status" = 'completed'
        AND "slot_start" >= ${fromDate}
        AND "slot_start" <= ${toDate}
      GROUP BY day
      ORDER BY day ASC
    `;

    const byDay = daily.map((row) => ({
      date: row.day.toISOString().slice(0, 10), // YYYY-MM-DD
      count: Number(row.count),
      revenueAed: row.revenue ?? 0,
    }));

    res.json({
      summary,
      byService,
      byDay,
    });
  }),
);
