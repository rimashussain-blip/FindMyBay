// Payment service.
//
// Two operations:
//   1. createIntentForBooking(bookingId, customerId)
//      → creates a Payment row in `pending`, calls the configured processor
//        to get a hosted-page URL, returns it to the client.
//   2. confirmPayment(paymentRef, succeeded, externalRef?, failureReason?)
//      → flips Payment to succeeded/failed inside a transaction. On success,
//        transitions the Booking from pending_payment to confirmed and
//        schedules the smart-alert. Idempotent: replaying a webhook is safe.

import crypto from 'node:crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { HttpError } from '../lib/error.js';
import { logger } from '../lib/logger.js';
import { scheduleAlertForBooking } from '../alert/service.js';
import { emitBookingStatus, emitVendorBookingChanged } from '../realtime/server.js';
import { getPaymentProcessor } from './processors/index.js';
import { assignInvoiceNumber } from '../lib/invoice.js';

export interface IntentDto {
  paymentRef: string;
  hostedPageUrl: string;
  processor: string;
  amountAed: number;
  status: string;
}

/**
 * Create (or re-create) a payment intent for a booking. Only the booking's
 * customer can call this. A booking already in confirmed/in-progress/etc.
 * does not need a new intent — caller gets a 409.
 */
export async function createIntentForBooking(
  bookingId: string,
  customerId: string,
): Promise<IntentDto> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      vendor: { select: { brandName: true } },
      service: { select: { name: true } },
      customer: { select: { phone: true, email: true } },
    },
  });
  if (!booking || booking.customerId !== customerId) {
    throw new HttpError(404, 'Booking not found', { code: 'booking_not_found' });
  }
  if (booking.status !== 'pending_payment') {
    throw new HttpError(409, `Booking is ${booking.status}; payment not required`, {
      code: 'booking_not_payable',
    });
  }

  // If we already have a pending intent for this booking, return the same one
  // — clicking the Pay button twice should not create two processor sessions.
  const existing = await prisma.payment.findFirst({
    where: { bookingId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing && existing.hostedPageUrl) {
    return {
      paymentRef: existing.processorRef,
      hostedPageUrl: existing.hostedPageUrl,
      processor: existing.processor,
      amountAed: existing.amountAed,
      status: String(existing.status),
    };
  }

  const processor = getPaymentProcessor();
  // 24-byte random ref, urlsafe, stable across the whole flow.
  const paymentRef = crypto.randomBytes(24).toString('base64url');

  const result = await processor.createIntent({
    paymentRef,
    bookingId: booking.id,
    amountAed: booking.totalAed,
    description: `${booking.vendor.brandName} — ${booking.service.name}`,
    // Walk-ins (customer === null) never reach this code: they have no
    // customerId, so the !customerId check above already 404s. The optional
    // chain just narrows TS away from `null`.
    customerEmail: booking.customer?.email ?? undefined,
    customerPhone: booking.customer?.phone ?? undefined,
    returnUrl: env.PAYMENT_RETURN_DEEP_LINK,
    webhookUrl: `${env.PUBLIC_API_BASE_URL}/payments/${paymentRef}/webhook/${processor.name}`,
  });

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      processor: processor.name,
      processorRef: paymentRef,
      externalRef: result.externalRef ?? null,
      amountAed: booking.totalAed,
      status: 'pending',
      hostedPageUrl: result.hostedPageUrl,
    },
  });

  logger.info(
    { bookingId, paymentRef, processor: processor.name, amountAed: booking.totalAed },
    'payment intent created',
  );

  return {
    paymentRef: payment.processorRef,
    hostedPageUrl: result.hostedPageUrl,
    processor: processor.name,
    amountAed: payment.amountAed,
    status: String(payment.status),
  };
}

/**
 * Apply a webhook outcome. Called by the payment router after the processor
 * has been verified. Transitions Booking → confirmed atomically with the
 * Payment row, schedules the alert, and emits realtime events.
 *
 * Idempotent: returns the current state if the payment already moved on.
 */
export async function confirmPayment(input: {
  paymentRef: string;
  succeeded: boolean;
  externalRef?: string;
  failureReason?: string;
}): Promise<{ paymentStatus: string; bookingStatus: string; bookingId: string }> {
  const { paymentRef, succeeded, externalRef, failureReason } = input;

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { processorRef: paymentRef },
      include: { booking: true },
    });
    if (!payment) throw new HttpError(404, 'Payment not found', { code: 'payment_not_found' });

    // Idempotency: a replay of an already-finalised webhook is a no-op.
    if (payment.status !== 'pending') {
      return {
        paymentStatus: String(payment.status),
        bookingStatus: String(payment.booking.status),
        bookingId: payment.bookingId,
        booked: false as const,
      };
    }

    if (!succeeded) {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          externalRef: externalRef ?? payment.externalRef,
          failureReason: failureReason ?? null,
        },
      });
      return {
        paymentStatus: String(updated.status),
        bookingStatus: String(payment.booking.status),
        bookingId: payment.bookingId,
        booked: false as const,
      };
    }

    // Success path. Verify booking is still payable; another concurrent pay
    // race or a manual cancel would have moved it on.
    if (payment.booking.status !== 'pending_payment') {
      // Mark the duplicate payment as cancelled so we don't keep counting it.
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'cancelled',
          externalRef: externalRef ?? payment.externalRef,
          failureReason: 'booking already finalised',
        },
      });
      return {
        paymentStatus: 'cancelled',
        bookingStatus: String(payment.booking.status),
        bookingId: payment.bookingId,
        booked: false as const,
      };
    }

    const paidAt = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'succeeded',
        externalRef: externalRef ?? payment.externalRef,
        paidAt,
      },
    });
    const updatedBooking = await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'confirmed' },
    });
    // Money has cleared at the processor — claim the FTA-compliant invoice
    // number now so a customer-facing receipt is available immediately.
    // Same transaction as the status flip so we never end up with a
    // confirmed booking that's missing an invoice (or vice versa).
    await assignInvoiceNumber(tx, updatedBooking.vendorId, updatedBooking.id);

    return {
      paymentStatus: 'succeeded',
      bookingStatus: String(updatedBooking.status),
      bookingId: payment.bookingId,
      vendorId: updatedBooking.vendorId,
      slotStart: updatedBooking.slotStart,
      customerId: updatedBooking.customerId,
      booked: true as const,
    };
  });

  // Side-effects post-commit. Wrap each so a failure doesn't roll back the
  // payment confirmation; the customer has already paid.
  if (result.booked) {
    try {
      await scheduleAlertForBooking(result.bookingId, result.slotStart);
    } catch (err) {
      logger.warn({ err, bookingId: result.bookingId }, 'failed to schedule alert post-payment');
    }
    try {
      emitBookingStatus(result.customerId, result.bookingId, 'confirmed');
      // Vendor's open Walk-in calendar refetches and the just-paid slot
      // disappears from "available".
      emitVendorBookingChanged(result.vendorId, result.bookingId, 'confirmed');
    } catch (err) {
      logger.warn({ err, bookingId: result.bookingId }, 'failed to emit booking:status');
    }
    logger.info(
      { paymentRef, bookingId: result.bookingId, externalRef },
      'payment confirmed → booking confirmed',
    );
  } else {
    logger.info(
      { paymentRef, status: result.paymentStatus, bookingStatus: result.bookingStatus },
      'payment terminal (no booking transition)',
    );
  }

  return {
    paymentStatus: result.paymentStatus,
    bookingStatus: result.bookingStatus,
    bookingId: result.bookingId,
  };
}

/**
 * Read-only status lookup the Android app polls after returning from the
 * Custom Tab. We expose only the customer's own payments.
 */
export async function getPaymentStatus(
  paymentRef: string,
  customerId: string,
): Promise<{ paymentRef: string; status: string; bookingId: string; bookingStatus: string }> {
  const payment = await prisma.payment.findUnique({
    where: { processorRef: paymentRef },
    include: { booking: { select: { id: true, status: true, customerId: true } } },
  });
  if (!payment || payment.booking.customerId !== customerId) {
    throw new HttpError(404, 'Payment not found', { code: 'payment_not_found' });
  }
  return {
    paymentRef: payment.processorRef,
    status: String(payment.status),
    bookingId: payment.bookingId,
    bookingStatus: String(payment.booking.status),
  };
}
