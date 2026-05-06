import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { asyncHandler, HttpError } from '../lib/error.js';
import { requireAuth } from '../auth/middleware.js';
import { logger } from '../lib/logger.js';
import { emitBookingStatus, emitVendorBookingChanged } from '../realtime/server.js';
import { createBooking, listMyBookings } from './service.js';
import { buildQrString } from './qr.js';

export const bookingRouter = Router();

const createBody = z.object({
  vendorId: z.string().min(1),
  serviceId: z.string().min(1),
  slotStart: z.string().min(1), // ISO 8601
});

bookingRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const { vendorId, serviceId, slotStart } = createBody.parse(req.body);
    const booking = await createBooking({
      customerId: req.user.id,
      vendorId,
      serviceId,
      slotStartIso: slotStart,
    });
    res.status(201).json(booking);
  }),
);

bookingRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const items = await listMyBookings(req.user.id);
    res.json({ items });
  }),
);

// ── Cancellation ─────────────────────────────────────────────────────────

const CANCELLABLE_STATUSES = [
  'pending_payment',
  'confirmed',
  'alert_scheduled',
  'alerted',
] as const;

const cancelBody = z.object({ reason: z.string().max(200).optional() });

/**
 * POST /bookings/:id/cancel
 *
 * Customer-side cancellation. Allowed up until check-in (`in_progress`).
 * Atomically flips the booking to `cancelled`, cancels any scheduled alert
 * (the alert worker would also cancel it lazily, but doing it here saves
 * a tick), and marks any in-flight Payment as `cancelled`.
 *
 * Refund handling is not wired yet (mock processor doesn't actually charge).
 * Per spec the policy is: free if cancelled >30 min before slot start, AED
 * 10 fee otherwise. Returning the policy outcome on the response so the
 * client can surface it; actual money movement is a follow-up.
 */
bookingRouter.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    cancelBody.parse(req.body ?? {});

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: req.params.id } });
      if (!booking || booking.customerId !== req.user!.id) {
        throw new HttpError(404, 'Booking not found', { code: 'booking_not_found' });
      }
      if (!CANCELLABLE_STATUSES.includes(booking.status as (typeof CANCELLABLE_STATUSES)[number])) {
        throw new HttpError(409, `Booking is ${booking.status}; can't cancel`, {
          code: 'booking_not_cancellable',
        });
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'cancelled' },
      });

      // Eagerly cancel scheduled alerts so the worker doesn't probe Distance
      // Matrix one more time before noticing.
      await tx.alert.updateMany({
        where: { bookingId: booking.id, status: 'scheduled' },
        data: { status: 'cancelled' },
      });

      // Mark any in-flight payment as cancelled. Successful payments stay
      // succeeded — refund processing would happen in a separate flow.
      await tx.payment.updateMany({
        where: { bookingId: booking.id, status: 'pending' },
        data: { status: 'cancelled', failureReason: 'booking cancelled by customer' },
      });

      // Compute the refund hint per spec policy (informational only).
      const minsToSlot = Math.floor((booking.slotStart.getTime() - Date.now()) / 60_000);
      const refundPolicy = minsToSlot > 30 ? 'free' : 'late_fee_aed_10';

      return { booking: updated, minsToSlot, refundPolicy };
    });

    emitBookingStatus(req.user.id, result.booking.id, 'cancelled');
    emitVendorBookingChanged(result.booking.vendorId, result.booking.id, 'cancelled');
    logger.info(
      {
        bookingId: result.booking.id,
        minsToSlot: result.minsToSlot,
        refundPolicy: result.refundPolicy,
      },
      'booking cancelled by customer',
    );

    res.json({
      id: result.booking.id,
      status: String(result.booking.status),
      refundPolicy: result.refundPolicy,
      minsToSlot: result.minsToSlot,
    });
  }),
);

/**
 * GET /bookings/:id/qr
 * Returns the signed string the customer's phone renders as a QR.
 * Only the booking's customer can request it.
 */
bookingRouter.get(
  '/:id/qr',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: { select: { brandName: true, logoUrl: true } },
        bay: { select: { name: true } },
        // Pull the customer's car details so the QR screen can show them
        // alongside the code — the attendant scans the QR and immediately
        // sees the plate they're looking for, no extra lookup.
        customer: {
          select: {
            carMake: true,
            carType: true,
            carColor: true,
            carPlate: true,
          },
        },
      },
    });
    if (!booking || booking.customerId !== req.user.id) {
      throw new HttpError(404, 'Booking not found', { code: 'booking_not_found' });
    }
    // booking.customer is non-null here by construction: customerId !== req.user.id
    // already excluded walk-ins (customerId === null), and the include guarantees
    // the relation. The `?? null` fallbacks below silence TS rather than reflect a
    // real runtime branch.
    if (['cancelled', 'completed', 'no_show'].includes(booking.status)) {
      throw new HttpError(409, `Booking is ${booking.status}; check-in not available`, {
        code: 'booking_not_active',
      });
    }
    const qrString = buildQrString({
      bookingId: booking.id,
      vendorId: booking.vendorId,
      customerId: booking.customerId,
      slotStart: booking.slotStart,
    });
    res.json({
      qr: qrString,
      bookingId: booking.id,
      slotStart: booking.slotStart.toISOString(),
      status: String(booking.status),
      vendorName: booking.vendor.brandName,
      vendorLogoUrl: booking.vendor.logoUrl,
      bayName: booking.bay?.name ?? null,
      carMake: booking.customer?.carMake ?? null,
      carType: booking.customer?.carType ?? null,
      carColor: booking.customer?.carColor ?? null,
      carPlate: booking.customer?.carPlate ?? null,
    });
  }),
);

// -------------------------------------------------------------
// Reviews
// -------------------------------------------------------------

const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

/**
 * POST /bookings/:id/review
 * Customer submits a 1-5 star rating + optional note for a completed booking.
 * Recomputes the vendor's ratingAvg.
 */
bookingRouter.post(
  '/:id/review',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const body = reviewBody.parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking || booking.customerId !== req.user.id) {
      throw new HttpError(404, 'Booking not found', { code: 'booking_not_found' });
    }
    if (booking.status !== 'completed' && booking.status !== 'in_progress') {
      throw new HttpError(409, 'Reviews are only allowed on completed bookings', {
        code: 'booking_not_complete',
      });
    }

    const review = await prisma.review.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        customerId: booking.customerId,
        rating: body.rating,
        note: body.note ?? null,
      },
      update: { rating: body.rating, note: body.note ?? null },
    });

    // Recompute vendor average.
    const agg = await prisma.review.aggregate({
      where: { vendorId: booking.vendorId },
      _avg: { rating: true },
    });
    if (agg._avg.rating != null) {
      await prisma.vendor.update({
        where: { id: booking.vendorId },
        data: { ratingAvg: agg._avg.rating },
      });
    }

    res.status(201).json({
      id: review.id,
      bookingId: review.bookingId,
      rating: review.rating,
      note: review.note,
      createdAt: review.createdAt.toISOString(),
    });
  }),
);

/**
 * GET /bookings/:id/review
 * Customer fetches their own review for a booking (so the UI can show "edit" instead of "submit").
 */
bookingRouter.get(
  '/:id/review',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const review = await prisma.review.findUnique({ where: { bookingId: req.params.id } });
    if (!review || review.customerId !== req.user.id) {
      return res.status(404).json({ error: 'review_not_found' });
    }
    return res.json({
      id: review.id,
      bookingId: review.bookingId,
      rating: review.rating,
      note: review.note,
      createdAt: review.createdAt.toISOString(),
    });
  }),
);
