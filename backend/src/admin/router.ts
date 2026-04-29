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
import { emitBayUpdate, emitBookingStatus } from '../realtime/server.js';
import { sendWashCompletePush } from '../notify/washComplete.js';

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
        customer: { select: { id: true, phone: true, fullName: true } },
        service: { select: { id: true, name: true, durationMin: true, priceAed: true } },
        bay: { select: { id: true, name: true } },
      },
    });

    res.json({
      items: bookings.map((b) => ({
        id: b.id,
        status: String(b.status),
        slotStart: b.slotStart.toISOString(),
        slotEnd: b.slotEnd.toISOString(),
        totalAed: b.totalAed,
        customer: {
          id: b.customer.id,
          phone: b.customer.phone,
          fullName: b.customer.fullName,
        },
        service: b.service,
        bay: b.bay,
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
          customer: { select: { id: true, phone: true, fullName: true } },
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
          customer: { select: { id: true, phone: true, fullName: true } },
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
      emitBookingStatus(result.booking.customerId, result.booking.id, 'in_progress');
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
        customer: { select: { id: true, phone: true, fullName: true } },
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
          customer: { select: { id: true, phone: true, fullName: true } },
          service: { select: { id: true, name: true, durationMin: true } },
          bay: { select: { id: true, name: true } },
        },
      });
      await tx.bay.update({ where: { id: match.bayId }, data: { status: 'busy' } });
      return u;
    });

    void emitBayUpdate(req.vendor!.id, updated.bayId, 'busy');
    emitBookingStatus(updated.customerId, updated.id, 'in_progress');
    logger.info({ bookingId: updated.id, code: suffix }, 'check-in via short code');

    res.json({
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
        customerName: r.booking.customer.fullName ?? maskPhone(r.booking.customer.phone),
      })),
    });
  }),
);

function maskPhone(phone: string | null): string {
  if (!phone) return 'Customer';
  const last4 = phone.slice(-4);
  return `Customer ···${last4}`;
}
