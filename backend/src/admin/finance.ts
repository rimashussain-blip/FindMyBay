// Vendor admin → Finance.
//
// Three families of endpoints:
//   1. Overview — KPIs over a date range (gross, net, VAT, refunds, count)
//   2. Invoices — paginated list + single invoice detail (FTA-compliant)
//   3. VAT     — VAT collected summary, downloadable as CSV for filing
//   4. Refunds — list + create + void
//
// All routes are vendor-scoped via requireVendor(). Mutating endpoints
// (record refund, void refund) require 'owner'; reads are open to any
// active role so managers can pull invoices for customer queries.

import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { asyncHandler, HttpError } from '../lib/error.js';
import { prisma } from '../config/db.js';
import { requireAuth } from '../auth/middleware.js';
import { requireVendor } from './middleware.js';
import { UAE_VAT_RATE_PCT } from '../lib/vat.js';
import { assignCreditNoteNumber } from '../lib/invoice.js';
import { logger } from '../lib/logger.js';
import { getPaymentProcessor } from '../payment/processors/index.js';

export const financeRouter = Router();

// Date-range query helper. Defaults to trailing 30 days ending now.
const rangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function resolveRange(q: z.infer<typeof rangeQuery>): { from: Date; to: Date } {
  const now = new Date();
  const to = q.to ? new Date(q.to) : now;
  const from = q.from ? new Date(q.from) : new Date(now.getTime() - 30 * 86_400_000);
  return { from, to };
}

// ── 1. Overview ──────────────────────────────────────────────────────────

financeRouter.get(
  '/finance/overview',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const { from, to } = resolveRange(rangeQuery.parse(req.query));
    const vendorId = req.vendor!.id;

    // We bucket revenue on the booking's slotStart — that's the date the
    // service was delivered, which matches the FTA's view of the supply
    // date. Refunds bucket on createdAt (the date the credit note was
    // issued), which is also FTA's view of when the supply was reversed.

    const completedWhere = {
      vendorId,
      status: 'completed' as const,
      slotStart: { gte: from, lte: to },
    };

    const [grossAgg, refundAgg, paidCountAgg, cashCountAgg] = await Promise.all([
      prisma.booking.aggregate({
        where: completedWhere,
        _sum: { totalAed: true, vatAed: true, discountAed: true },
        _count: { _all: true },
      }),
      prisma.refund.aggregate({
        where: {
          vendorId,
          status: 'processed',
          createdAt: { gte: from, lte: to },
        },
        _sum: { amountAed: true, vatAed: true },
        _count: { _all: true },
      }),
      prisma.booking.count({
        where: {
          ...completedWhere,
          isWalkIn: false,
          payments: { some: { status: 'succeeded' } },
        },
      }),
      prisma.booking.count({
        where: { ...completedWhere, isWalkIn: true },
      }),
    ]);

    const grossAed = grossAgg._sum.totalAed ?? 0;
    const vatCollectedAed = grossAgg._sum.vatAed ?? 0;
    const discountAed = grossAgg._sum.discountAed ?? 0;
    const refundsAed = refundAgg._sum.amountAed ?? 0;
    const refundVatAed = refundAgg._sum.vatAed ?? 0;
    const netAed = grossAed - refundsAed;
    const netVatAed = vatCollectedAed - refundVatAed;
    // Net-of-VAT is what the vendor actually keeps after FTA pass-through.
    const netExVatAed = netAed - netVatAed;

    res.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      bookings: {
        completed: grossAgg._count._all,
        appPaid: paidCountAgg,
        walkInCash: cashCountAgg,
      },
      revenue: {
        grossAed,
        refundsAed,
        netAed,
        discountAed,
      },
      vat: {
        collectedAed: vatCollectedAed,
        refundedAed: refundVatAed,
        netDueAed: netVatAed,
        ratePct: UAE_VAT_RATE_PCT,
      },
      payout: {
        // Pass-through math: vendor's keep after VAT is remitted. The actual
        // payout schedule is processor-side (Telr/NI settle T+2); we expose
        // the cleared figure so the owner sees what to expect.
        netToVendorExVatAed: netExVatAed,
      },
      refunds: {
        count: refundAgg._count._all,
        totalAed: refundsAed,
      },
    });
  }),
);

// ── 2. Invoices ──────────────────────────────────────────────────────────

const invoiceListQuery = rangeQuery.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['paid', 'unpaid', 'walkin', 'refunded']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

financeRouter.get(
  '/finance/invoices',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const q = invoiceListQuery.parse(req.query);
    const { from, to } = resolveRange(q);
    const vendorId = req.vendor!.id;

    // Base filter: only billable bookings (invoice number assigned). This
    // excludes pending_payment / cancelled / no_show automatically.
    const where: Prisma.BookingWhereInput = {
      vendorId,
      invoiceNumber: { not: null },
      slotStart: { gte: from, lte: to },
    };

    if (q.status === 'walkin') where.isWalkIn = true;
    if (q.status === 'paid') {
      where.isWalkIn = false;
      where.payments = { some: { status: 'succeeded' } };
    }
    if (q.status === 'unpaid') {
      where.isWalkIn = false;
      where.payments = { none: { status: 'succeeded' } };
    }
    if (q.status === 'refunded') {
      where.refunds = { some: { status: 'processed' } };
    }

    if (q.q) {
      const term = q.q;
      where.OR = [
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
        { walkInName: { contains: term, mode: 'insensitive' } },
        { walkInPhone: { contains: term, mode: 'insensitive' } },
        { customer: { fullName: { contains: term, mode: 'insensitive' } } },
        { customer: { phone: { contains: term, mode: 'insensitive' } } },
        { customer: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        orderBy: { slotStart: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          customer: { select: { fullName: true, phone: true, email: true } },
          service: { select: { name: true } },
          payments: {
            select: { status: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          refunds: {
            where: { status: 'processed' },
            select: { amountAed: true },
          },
        },
      }),
    ]);

    res.json({
      page: q.page,
      pageSize: q.pageSize,
      total,
      items: rows.map((b) => {
        const refunded = b.refunds.reduce((sum, r) => sum + r.amountAed, 0);
        return {
          id: b.id,
          invoiceNumber: b.invoiceNumber!,
          slotStart: b.slotStart.toISOString(),
          totalAed: b.totalAed,
          vatAed: b.vatAed,
          discountAed: b.discountAed,
          refundedAed: refunded,
          netAed: b.totalAed - refunded,
          isWalkIn: b.isWalkIn,
          paymentStatus: b.isWalkIn
            ? 'cash'
            : b.payments[0]?.status === 'succeeded'
              ? 'paid'
              : 'unpaid',
          serviceName: b.service.name,
          customerName: b.customer?.fullName ?? b.walkInName ?? null,
          customerPhone: b.customer?.phone ?? b.walkInPhone ?? null,
          customerEmail: b.customer?.email ?? null,
        };
      }),
    });
  }),
);

// Single invoice — surfaces everything needed to render an FTA-compliant
// tax invoice (vendor TRN + brand, customer line, service line, VAT
// breakdown, discount, refund summary, payment status).
financeRouter.get(
  '/finance/invoices/:id',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, vendorId, invoiceNumber: { not: null } },
      include: {
        vendor: {
          select: {
            brandName: true,
            trnNumber: true,
            addressLine: true,
            city: true,
            emirate: true,
            logoUrl: true,
          },
        },
        customer: { select: { fullName: true, phone: true, email: true } },
        service: { select: { name: true, priceAed: true, vatInclusive: true } },
        bay: { select: { name: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, processor: true, externalRef: true, paidAt: true },
        },
        refunds: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            amountAed: true,
            vatAed: true,
            reason: true,
            creditNoteNumber: true,
            status: true,
            createdAt: true,
          },
        },
        promotion: { select: { code: true, name: true } },
      },
    });
    if (!booking) {
      throw new HttpError(404, 'Invoice not found', { code: 'invoice_not_found' });
    }
    const refundedAed = booking.refunds
      .filter((r) => r.status === 'processed')
      .reduce((sum, r) => sum + r.amountAed, 0);

    res.json({
      id: booking.id,
      invoiceNumber: booking.invoiceNumber!,
      issuedAt: booking.createdAt.toISOString(),
      slotStart: booking.slotStart.toISOString(),
      slotEnd: booking.slotEnd.toISOString(),
      isWalkIn: booking.isWalkIn,
      vendor: {
        brandName: booking.vendor.brandName,
        trnNumber: booking.vendor.trnNumber,
        addressLine: booking.vendor.addressLine,
        city: booking.vendor.city,
        emirate: String(booking.vendor.emirate),
        logoUrl: booking.vendor.logoUrl,
      },
      customer: booking.customer
        ? {
            name: booking.customer.fullName,
            phone: booking.customer.phone,
            email: booking.customer.email,
          }
        : { name: booking.walkInName, phone: booking.walkInPhone, email: null },
      line: {
        serviceName: booking.service.name,
        bayName: booking.bay.name,
        // Show pre-VAT, VAT, and total separately. priceLineFromService
        // already split this at booking creation — we recompute the
        // pre-VAT figure from the stored vatAed + totalAed so historical
        // rows stay accurate.
        subtotalAed: booking.totalAed - booking.vatAed,
        vatAed: booking.vatAed,
        totalAed: booking.totalAed,
        discountAed: booking.discountAed,
        promoCode: booking.promotion?.code ?? null,
        promoName: booking.promotion?.name ?? null,
      },
      payment: booking.isWalkIn
        ? { method: 'cash', status: 'cash' }
        : {
            method: booking.payments[0]?.processor ?? null,
            status: booking.payments[0]?.status ?? 'unpaid',
            paidAt: booking.payments[0]?.paidAt?.toISOString() ?? null,
            externalRef: booking.payments[0]?.externalRef ?? null,
          },
      refunds: booking.refunds.map((r) => ({
        id: r.id,
        creditNoteNumber: r.creditNoteNumber,
        amountAed: r.amountAed,
        vatAed: r.vatAed,
        reason: r.reason,
        status: String(r.status),
        createdAt: r.createdAt.toISOString(),
      })),
      summary: {
        refundedAed,
        netAed: booking.totalAed - refundedAed,
        vatRatePct: UAE_VAT_RATE_PCT,
      },
    });
  }),
);

// ── 3. VAT summary (filing helper) ───────────────────────────────────────
//
// Returns per-month or per-day buckets of VAT collected + refunded for the
// date range. JSON by default; ?format=csv returns a CSV download suitable
// for FTA quarterly filings. The numbers match the overview KPIs.

const vatSummaryQuery = rangeQuery.extend({
  // 'month' bucket = one row per calendar month (FTA filing cadence);
  // 'day' bucket   = one row per day (auditing / reconciliation).
  bucket: z.enum(['day', 'month']).default('month'),
  format: z.enum(['json', 'csv']).default('json'),
});

financeRouter.get(
  '/finance/vat-summary',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const q = vatSummaryQuery.parse(req.query);
    const { from, to } = resolveRange(q);
    const vendorId = req.vendor!.id;
    const trunc = q.bucket === 'month' ? 'month' : 'day';

    // We do two raw aggregates (gross + refunds) and stitch them together.
    // Truncating in Postgres is the cheapest way to bucket by month
    // regardless of timezone.
    const grossRows = await prisma.$queryRaw<
      Array<{ bucket: Date; gross: number | null; vat: number | null; count: bigint }>
    >`
      SELECT
        date_trunc(${trunc}, "slot_start") AS bucket,
        COALESCE(SUM("total_aed"), 0)::int AS gross,
        COALESCE(SUM("vat_aed"), 0)::int   AS vat,
        COUNT(*)::bigint                   AS count
      FROM "bookings"
      WHERE "vendor_id" = ${vendorId}
        AND "status" = 'completed'
        AND "slot_start" >= ${from}
        AND "slot_start" <= ${to}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const refundRows = await prisma.$queryRaw<
      Array<{ bucket: Date; refunded: number | null; vat: number | null }>
    >`
      SELECT
        date_trunc(${trunc}, "created_at") AS bucket,
        COALESCE(SUM("amount_aed"), 0)::int AS refunded,
        COALESCE(SUM("vat_aed"), 0)::int    AS vat
      FROM "refunds"
      WHERE "vendor_id" = ${vendorId}
        AND "status" = 'processed'
        AND "created_at" >= ${from}
        AND "created_at" <= ${to}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const refundsByKey = new Map(
      refundRows.map((r) => [r.bucket.toISOString(), r] as const),
    );

    const buckets = grossRows.map((g) => {
      const key = g.bucket.toISOString();
      const refund = refundsByKey.get(key);
      refundsByKey.delete(key);
      const gross = g.gross ?? 0;
      const vatCollected = g.vat ?? 0;
      const refunded = refund?.refunded ?? 0;
      const vatRefunded = refund?.vat ?? 0;
      return {
        bucket: g.bucket.toISOString().slice(0, q.bucket === 'month' ? 7 : 10),
        bookings: Number(g.count),
        grossAed: gross,
        refundedAed: refunded,
        netAed: gross - refunded,
        vatCollectedAed: vatCollected,
        vatRefundedAed: vatRefunded,
        vatDueAed: vatCollected - vatRefunded,
      };
    });

    // Any refund buckets that didn't have corresponding sales (rare —
    // refunds outliving a closed bookings window) get appended so the
    // total still reconciles.
    for (const [key, r] of refundsByKey) {
      buckets.push({
        bucket: key.slice(0, q.bucket === 'month' ? 7 : 10),
        bookings: 0,
        grossAed: 0,
        refundedAed: r.refunded ?? 0,
        netAed: -(r.refunded ?? 0),
        vatCollectedAed: 0,
        vatRefundedAed: r.vat ?? 0,
        vatDueAed: -(r.vat ?? 0),
      });
    }
    buckets.sort((a, b) => a.bucket.localeCompare(b.bucket));

    const totals = buckets.reduce(
      (acc, b) => ({
        bookings: acc.bookings + b.bookings,
        grossAed: acc.grossAed + b.grossAed,
        refundedAed: acc.refundedAed + b.refundedAed,
        netAed: acc.netAed + b.netAed,
        vatCollectedAed: acc.vatCollectedAed + b.vatCollectedAed,
        vatRefundedAed: acc.vatRefundedAed + b.vatRefundedAed,
        vatDueAed: acc.vatDueAed + b.vatDueAed,
      }),
      {
        bookings: 0,
        grossAed: 0,
        refundedAed: 0,
        netAed: 0,
        vatCollectedAed: 0,
        vatRefundedAed: 0,
        vatDueAed: 0,
      },
    );

    if (q.format === 'csv') {
      // FTA filings want a flat CSV. UTF-8 with a BOM so Excel opens it in
      // the right encoding.
      const lines = [
        'Period,Bookings,Gross (AED),Refunded (AED),Net (AED),VAT collected (AED),VAT refunded (AED),VAT due (AED)',
        ...buckets.map((b) =>
          [
            b.bucket,
            b.bookings,
            b.grossAed,
            b.refundedAed,
            b.netAed,
            b.vatCollectedAed,
            b.vatRefundedAed,
            b.vatDueAed,
          ].join(','),
        ),
        [
          'TOTAL',
          totals.bookings,
          totals.grossAed,
          totals.refundedAed,
          totals.netAed,
          totals.vatCollectedAed,
          totals.vatRefundedAed,
          totals.vatDueAed,
        ].join(','),
      ];
      const csv = '﻿' + lines.join('\r\n') + '\r\n';
      const fname = `vat-summary-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      return res.send(csv);
    }

    return res.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      bucket: q.bucket,
      ratePct: UAE_VAT_RATE_PCT,
      items: buckets,
      totals,
    });
  }),
);

// ── 4. Refunds ───────────────────────────────────────────────────────────

const refundBody = z.object({
  amountAed: z.number().int().min(1).max(100_000),
  reason: z.string().trim().min(1).max(280),
});

// Record a refund against a billable booking. The actual money movement
// happens out-of-band (card terminal, cash drawer, processor portal) —
// this endpoint just logs it + mints the credit-note number.
financeRouter.post(
  '/bookings/:id/refund',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const { amountAed, reason } = refundBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const userId = req.user!.id;

    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, vendorId, invoiceNumber: { not: null } },
      include: {
        refunds: {
          where: { status: 'processed' },
          select: { amountAed: true },
        },
        // Latest successful payment — drives the processor-side refund call.
        payments: {
          where: { status: 'succeeded' },
          orderBy: { paidAt: 'desc' },
          take: 1,
          select: { processor: true, externalRef: true },
        },
      },
    });
    if (!booking) {
      throw new HttpError(404, 'Booking not found or not yet billable', {
        code: 'booking_not_found',
      });
    }

    const alreadyRefunded = booking.refunds.reduce((s, r) => s + r.amountAed, 0);
    const remaining = booking.totalAed - alreadyRefunded;
    if (amountAed > remaining) {
      throw new HttpError(
        409,
        `Refund exceeds remaining balance (AED ${remaining}). Reduce the amount or void prior refunds.`,
        { code: 'over_refund', details: { remaining } },
      );
    }

    // VAT share = same proportion of the booking's VAT. Avoids drift when
    // the customer paid an inclusive price.
    const vatShare =
      booking.totalAed > 0
        ? Math.round((booking.vatAed * amountAed) / booking.totalAed)
        : 0;

    // Generate a refund ref UP FRONT so the processor can echo it back
    // in its metadata. The Refund row itself gets its own cuid below.
    const refundRef = crypto.randomBytes(18).toString('base64url');

    // Talk to the processor BEFORE writing the Refund row. If the
    // processor fails we never persist anything — the route 4xx's and
    // the owner sees the error. If the booking has no Payment row
    // (e.g. walk-in cash, refunded by hand at the desk) we skip the
    // processor call and record the Refund as out-of-band — same V1
    // semantics, just no processor_ref on the row.
    const payment = booking.payments[0] ?? null;
    let processorRef: string | null = null;
    if (payment && payment.externalRef) {
      const processor = getPaymentProcessor();
      // Only call the processor if its name matches the Payment's
      // recorded processor — defensive guard against env swaps after
      // the original charge.
      if (processor.name === payment.processor) {
        try {
          const result = await processor.refund({
            refundRef,
            externalRef: payment.externalRef,
            amountAed,
            reason,
          });
          if (!result.refunded) {
            throw new HttpError(
              502,
              result.message ?? 'Payment processor rejected the refund',
              { code: 'processor_refund_failed' },
            );
          }
          processorRef = result.externalRef ?? null;
        } catch (err) {
          if (err instanceof HttpError) throw err;
          logger.error({ err, bookingId: booking.id }, 'processor refund threw');
          throw new HttpError(502, 'Payment processor refund failed', {
            code: 'processor_refund_failed',
            details: { message: err instanceof Error ? err.message : String(err) },
          });
        }
      } else {
        logger.warn(
          { paymentProcessor: payment.processor, currentProcessor: processor.name },
          'refund called on a payment from a different processor — recording as out-of-band',
        );
      }
    }

    const refund = await prisma.$transaction(async (tx) => {
      const creditNoteNumber = await assignCreditNoteNumber(tx, vendorId);
      return tx.refund.create({
        data: {
          bookingId: booking.id,
          vendorId,
          amountAed,
          vatAed: vatShare,
          reason,
          status: 'processed',
          creditNoteNumber,
          processorRef,
          createdById: userId,
        },
      });
    });

    logger.info(
      {
        refundId: refund.id,
        bookingId: booking.id,
        vendorId,
        amountAed,
        vatShare,
        creditNoteNumber: refund.creditNoteNumber,
        processorRef,
      },
      'refund recorded',
    );

    res.status(201).json({
      id: refund.id,
      creditNoteNumber: refund.creditNoteNumber,
      amountAed: refund.amountAed,
      vatAed: refund.vatAed,
      reason: refund.reason,
      status: String(refund.status),
      processorRef: refund.processorRef,
      createdAt: refund.createdAt.toISOString(),
    });
  }),
);

// List refunds for the date range. Used by the Refunds tab on /finance.
const refundListQuery = rangeQuery.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

financeRouter.get(
  '/finance/refunds',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const q = refundListQuery.parse(req.query);
    const { from, to } = resolveRange(q);
    const vendorId = req.vendor!.id;

    const where = { vendorId, createdAt: { gte: from, lte: to } };
    const [total, rows] = await Promise.all([
      prisma.refund.count({ where }),
      prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          booking: {
            select: {
              id: true,
              invoiceNumber: true,
              slotStart: true,
              walkInName: true,
              walkInPhone: true,
              customer: { select: { fullName: true, phone: true } },
              service: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    res.json({
      page: q.page,
      pageSize: q.pageSize,
      total,
      items: rows.map((r) => ({
        id: r.id,
        creditNoteNumber: r.creditNoteNumber,
        amountAed: r.amountAed,
        vatAed: r.vatAed,
        reason: r.reason,
        status: String(r.status),
        createdAt: r.createdAt.toISOString(),
        booking: {
          id: r.booking.id,
          invoiceNumber: r.booking.invoiceNumber,
          slotStart: r.booking.slotStart.toISOString(),
          serviceName: r.booking.service.name,
          customerName: r.booking.customer?.fullName ?? r.booking.walkInName ?? null,
          customerPhone: r.booking.customer?.phone ?? r.booking.walkInPhone ?? null,
        },
      })),
    });
  }),
);

// Void a previously-recorded refund. Doesn't delete the row — the audit
// trail stays — but flips the status so it stops counting toward totals.
// Use case: staff member fat-fingered the amount or refunded the wrong booking.
financeRouter.post(
  '/finance/refunds/:id/void',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const refund = await prisma.refund.findFirst({
      where: { id: req.params.id, vendorId },
    });
    if (!refund) throw new HttpError(404, 'Refund not found', { code: 'not_found' });
    if (refund.status === 'voided') {
      return res.json({ id: refund.id, status: 'voided', alreadyVoid: true });
    }
    const updated = await prisma.refund.update({
      where: { id: refund.id },
      data: { status: 'voided' },
    });
    return res.json({ id: updated.id, status: String(updated.status) });
  }),
);

// ── 5. Payouts ───────────────────────────────────────────────────────────
//
// A Payout is the platform's settlement to a vendor for a date range.
// V1 owners trigger this manually:
//   GET    /finance/payouts             — list closed periods
//   POST   /finance/payouts/preview     — what would this period total?
//   POST   /finance/payouts             — close the period + lock the totals
//   POST   /finance/payouts/:id/mark-paid — flip to paid + capture bank ref
//
// Real money movement is off-platform. The row tracks "what we owe" and
// "what's been paid" so the audit trail survives.

const payoutPreviewBody = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

async function snapshotForPeriod(vendorId: string, from: Date, to: Date) {
  const [grossAgg, refundAgg] = await Promise.all([
    prisma.booking.aggregate({
      where: {
        vendorId,
        status: 'completed',
        slotStart: { gte: from, lte: to },
      },
      _sum: { totalAed: true, vatAed: true },
      _count: { _all: true },
    }),
    prisma.refund.aggregate({
      where: {
        vendorId,
        status: 'processed',
        createdAt: { gte: from, lte: to },
      },
      _sum: { amountAed: true, vatAed: true },
    }),
  ]);
  const grossAed = grossAgg._sum.totalAed ?? 0;
  const vatCollectedAed = grossAgg._sum.vatAed ?? 0;
  const refundsAed = refundAgg._sum.amountAed ?? 0;
  const refundVatAed = refundAgg._sum.vatAed ?? 0;
  const netVatAed = vatCollectedAed - refundVatAed;
  const netAed = grossAed - refundsAed;
  // V1 fees = 0; placeholder for when commission lands.
  const feesAed = 0;
  const netToVendorAed = netAed - netVatAed - feesAed;
  return {
    grossAed,
    refundsAed,
    vatAed: netVatAed,
    feesAed,
    netToVendorAed,
    bookingCount: grossAgg._count._all,
  };
}

financeRouter.post(
  '/finance/payouts/preview',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const { periodStart, periodEnd } = payoutPreviewBody.parse(req.body);
    const snap = await snapshotForPeriod(req.vendor!.id, new Date(periodStart), new Date(periodEnd));
    res.json({ periodStart, periodEnd, ...snap });
  }),
);

financeRouter.post(
  '/finance/payouts',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const body = payoutPreviewBody.extend({ notes: z.string().max(500).optional() }).parse(req.body);
    const vendorId = req.vendor!.id;
    const userId = req.user!.id;
    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    if (periodEnd <= periodStart) {
      throw new HttpError(400, 'periodEnd must be after periodStart', { code: 'bad_range' });
    }
    const snap = await snapshotForPeriod(vendorId, periodStart, periodEnd);
    const created = await prisma.payout.create({
      data: {
        vendorId,
        periodStart,
        periodEnd,
        ...snap,
        notes: body.notes ?? null,
        createdById: userId,
      },
    });
    logger.info(
      { payoutId: created.id, vendorId, netToVendorAed: snap.netToVendorAed },
      'payout closed',
    );
    res.status(201).json(serializePayout(created));
  }),
);

financeRouter.get(
  '/finance/payouts',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const rows = await prisma.payout.findMany({
      where: { vendorId },
      orderBy: { periodEnd: 'desc' },
      take: 50,
    });
    res.json({ items: rows.map(serializePayout) });
  }),
);

const markPaidBody = z.object({
  paidExternalRef: z.string().trim().max(80).optional(),
  paidAt: z.string().datetime().optional(),
});

financeRouter.post(
  '/finance/payouts/:id/mark-paid',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const body = markPaidBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const payout = await prisma.payout.findFirst({
      where: { id: req.params.id, vendorId },
    });
    if (!payout) throw new HttpError(404, 'Payout not found', { code: 'not_found' });
    if (payout.status === 'paid') {
      return res.json({ ...serializePayout(payout), alreadyPaid: true });
    }
    const updated = await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'paid',
        paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
        paidExternalRef: body.paidExternalRef ?? null,
      },
    });
    return res.json(serializePayout(updated));
  }),
);

function serializePayout(p: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  grossAed: number;
  refundsAed: number;
  vatAed: number;
  feesAed: number;
  netToVendorAed: number;
  bookingCount: number;
  status: string;
  paidAt: Date | null;
  paidExternalRef: string | null;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: p.id,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    grossAed: p.grossAed,
    refundsAed: p.refundsAed,
    vatAed: p.vatAed,
    feesAed: p.feesAed,
    netToVendorAed: p.netToVendorAed,
    bookingCount: p.bookingCount,
    status: String(p.status),
    paidAt: p.paidAt?.toISOString() ?? null,
    paidExternalRef: p.paidExternalRef,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
  };
}
