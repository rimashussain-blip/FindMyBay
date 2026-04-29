// Payment router.
//
// Routes:
//   POST  /bookings/:id/pay              create or fetch a payment intent (auth)
//   GET   /payments/:ref/status          poll payment status               (auth)
//   POST  /payments/:ref/webhook/:driver processor → us callback           (public)
//   GET   /payments/mock/:ref/page       mock hosted "card" page           (public)
//   POST  /payments/mock/:ref/:outcome   succeed|fail mock click handler   (public)
//
// The two `/payments/mock/...` routes only function when PAYMENT_PROVIDER=mock.
// They render a tiny HTML page that POSTs back to itself with the chosen
// outcome, then redirects the customer to the deep link the Android app
// registers. This mirrors how a real processor's hosted page would behave —
// without the customer ever leaving the API host.

import express, { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../lib/error.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../auth/middleware.js';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import {
  createIntentForBooking,
  confirmPayment,
  getPaymentStatus,
} from './service.js';
import { signMockWebhook } from './processors/mock.js';
import { TelrPaymentProcessor } from './processors/telr.js';
import { getPaymentProcessor } from './processors/index.js';

// ── Customer API surface ─────────────────────────────────────────────────

export const bookingPayRouter = Router();

/** POST /bookings/:id/pay — start (or rejoin) a payment intent for a booking. */
bookingPayRouter.post(
  '/:id/pay',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const intent = await createIntentForBooking(req.params.id, req.user.id);
    res.status(201).json(intent);
  }),
);

// ── Webhook + mock pages (mounted under /payments) ──────────────────────

export const paymentRouter = Router();

/** GET /payments/:ref/status — auth'd polling fallback for the Android client. */
paymentRouter.get(
  '/:ref/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const status = await getPaymentStatus(req.params.ref, req.user.id);
    res.json(status);
  }),
);

/**
 * POST /payments/:ref/webhook/:driver
 *
 * Public — called by the processor (or by our own mock hosted page). The
 * `:driver` path component must match the configured PAYMENT_PROVIDER, both
 * to prevent a misrouted webhook from a previous provider and to make the
 * URL self-describing in logs.
 *
 * We mount express.raw() ONLY here so signature verification has the
 * untouched bytes; the rest of the API uses express.json() globally.
 */
paymentRouter.post(
  '/:ref/webhook/:driver',
  express.raw({ type: '*/*', limit: '256kb' }),
  asyncHandler(async (req, res) => {
    const driver = req.params.driver;
    const processor = getPaymentProcessor();
    if (driver !== processor.name) {
      throw new HttpError(400, `webhook for driver ${driver} but configured ${processor.name}`, {
        code: 'wrong_driver',
      });
    }

    let parsed;
    try {
      parsed = processor.parseWebhook(req.headers, req.body as Buffer);
    } catch (err) {
      logger.warn({ err: (err as Error).message, driver }, 'webhook rejected (parse/sig)');
      throw new HttpError(400, 'Webhook verification failed', { code: 'webhook_invalid' });
    }

    if (parsed.paymentRef !== req.params.ref) {
      throw new HttpError(400, 'Webhook ref mismatch', { code: 'ref_mismatch' });
    }

    // For Telr: webhooks aren't signed, so re-query the order before trusting it.
    if (processor instanceof TelrPaymentProcessor && parsed.succeeded && parsed.externalRef) {
      const verified = await processor.verifyOrder(parsed.externalRef);
      if (!verified.paid) {
        parsed = { ...parsed, succeeded: false, failureReason: verified.message };
      }
    }

    const result = await confirmPayment(parsed);
    res.json({ ok: true, ...result });
  }),
);

// ── Mock hosted page (PAYMENT_PROVIDER=mock only) ───────────────────────

function ensureMockProvider() {
  if (env.PAYMENT_PROVIDER !== 'mock') {
    throw new HttpError(404, 'Mock payment page is disabled', { code: 'mock_disabled' });
  }
}

/** GET /payments/mock/:ref/page — minimal hosted page with Pay/Fail buttons. */
paymentRouter.get(
  '/mock/:ref/page',
  asyncHandler(async (req, res) => {
    ensureMockProvider();
    const payment = await prisma.payment.findUnique({
      where: { processorRef: req.params.ref },
      include: { booking: { include: { vendor: { select: { brandName: true } }, service: { select: { name: true } } } } },
    });
    if (!payment) throw new HttpError(404, 'Payment not found', { code: 'payment_not_found' });

    const ref = payment.processorRef;
    const safeBrand = String(payment.booking.vendor.brandName).replace(/[<>&]/g, '');
    const safeService = String(payment.booking.service.name).replace(/[<>&]/g, '');
    const aed = payment.amountAed;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-store');
    res.send(renderMockPage({ ref, brand: safeBrand, service: safeService, aed, status: String(payment.status) }));
  }),
);

const mockOutcome = z.enum(['succeed', 'fail']);

/** POST /payments/mock/:ref/:outcome — applied when the customer clicks. */
paymentRouter.post(
  '/mock/:ref/:outcome',
  express.urlencoded({ extended: false }),
  asyncHandler(async (req, res) => {
    ensureMockProvider();
    const outcome = mockOutcome.parse(req.params.outcome);
    const ref = req.params.ref;

    const succeeded = outcome === 'succeed';
    // Build the same payload + signature the processor would produce, then
    // confirm via the same code path — so the dev flow exercises the
    // signature-verify branch end to end.
    const body = JSON.stringify({
      paymentRef: ref,
      status: succeeded ? 'succeeded' : 'failed',
      externalRef: `mock_${ref.slice(0, 12)}`,
      failureReason: succeeded ? undefined : 'Customer chose to fail (mock)',
    });
    const sig = signMockWebhook(body);

    // Apply directly (same outcome as if the processor POSTed to the webhook).
    const processor = getPaymentProcessor();
    const parsed = processor.parseWebhook({ 'x-mock-signature': sig }, body);
    await confirmPayment(parsed);

    // Redirect to the deep link the Android app registers. We append the
    // ref + status as querystring so the app can resume immediately
    // without a status() round trip — though it'll still poll for safety.
    const dl = new URL(env.PAYMENT_RETURN_DEEP_LINK);
    dl.searchParams.set('ref', ref);
    dl.searchParams.set('status', succeeded ? 'succeeded' : 'failed');
    res.redirect(302, dl.toString());
  }),
);

// ---------- HTML for the mock hosted page ----------

function renderMockPage(p: {
  ref: string;
  brand: string;
  service: string;
  aed: number;
  status: string;
}): string {
  const isPending = p.status === 'pending';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Find My Bay — Mock Payment</title>
  <style>
    body { font: 15px -apple-system, system-ui, Segoe UI, Roboto, sans-serif;
           margin: 0; background: #FAF7F0; color: #0E2A47; }
    .card { max-width: 380px; margin: 48px auto; background: #fff;
            border-radius: 18px; padding: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 1.4px;
               color: #6B7280; margin-bottom: 6px; }
    h1 { font-size: 18px; margin: 0 0 8px; font-weight: 700; }
    .muted { color: #6B7280; font-size: 13px; }
    .total { font-size: 28px; font-weight: 800; color: #1B5FA8; margin: 14px 0; }
    .row { display: flex; gap: 8px; margin-top: 18px; }
    button { flex: 1; padding: 14px; border-radius: 12px; border: 0;
             font-size: 14px; font-weight: 600; cursor: pointer; }
    .pay { background: #1B5FA8; color: #fff; }
    .fail { background: #fff; color: #D14343; border: 1px solid #F0CACA; }
    .note { font-size: 11px; color: #9CA3AF; margin-top: 16px; text-align: center; }
    .done { padding: 18px; background: #F1F4F8; border-radius: 12px;
            font-size: 13px; color: #6B7280; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="eyebrow">Mock payment · dev only</div>
    <h1>${p.brand}</h1>
    <div class="muted">${p.service}</div>
    <div class="total">AED ${p.aed}</div>
    ${
      isPending
        ? `
      <form method="post" action="/payments/mock/${p.ref}/succeed" style="margin:0">
        <button type="submit" class="pay">Pay AED ${p.aed}</button>
      </form>
      <form method="post" action="/payments/mock/${p.ref}/fail" style="margin:0">
        <button type="submit" class="fail" style="margin-top:8px">Fail payment</button>
      </form>
      <div class="note">No real card data is collected — this page only exists when PAYMENT_PROVIDER=mock.</div>
      `
        : `<div class="done">Payment status: <b>${p.status}</b>. You can close this tab.</div>`
    }
  </div>
</body>
</html>`;
}
