// Find My Bay — API entry point.
// Boots Express, wires up middlewares, mounts routers, starts listening.

import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorMiddleware, notFound } from './lib/error.js';
import { authRouter } from './auth/router.js';
import { vendorRouter } from './vendor/router.js';
import { bookingRouter } from './booking/router.js';
import { alertRouter } from './alert/router.js';
import { deviceRouter } from './device/router.js';
import { adminRouter } from './admin/router.js';
import { platformRouter } from './admin/platform.js';
import { promotionsRouter } from './admin/promotions.js';
import { staffRouter, staffPublicRouter } from './admin/staff.js';
import { financeRouter } from './admin/finance.js';
import { inventoryRouter } from './admin/inventory.js';
import { loyaltyRouter } from './admin/loyalty.js';
import { bookingPayRouter, paymentRouter } from './payment/router.js';
import { publicRouter } from './public/router.js';
import { startAlertWorker } from './alert/service.js';
import { initRealtime } from './realtime/server.js';

const app = express();

// --- Core middleware ---
app.use(express.json({ limit: '256kb' }));
app.use(
  cors({
    origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

// --- Health probe (used by load balancers / Docker healthchecks) ---
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// --- Routers ---
// Public (no auth) — used by the marketing site at findmybay.ae.
app.use('/public', publicRouter);
app.use('/auth', authRouter);
app.use('/vendors', vendorRouter);
// /bookings/:id/pay is mounted before bookingRouter so its path-specific
// route is matched first; the general bookingRouter then handles the rest.
app.use('/bookings', bookingPayRouter);
app.use('/bookings', bookingRouter);
app.use('/payments', paymentRouter);
app.use('/alerts', alertRouter);
app.use('/devices', deviceRouter);
// Platform-admin endpoints — guarded by requireRole('admin') inside.
// Mount BEFORE the vendor admin router so /admin/platform/* is matched first.
app.use('/admin/platform', platformRouter);
// Promotions live under /admin/promotions but are vendor-scoped (not platform).
// Mount BEFORE adminRouter so its specific routes win over any /admin/* catch.
app.use('/admin', promotionsRouter);
// Staff management — owner-gated routes under /admin/staff/*.
app.use('/admin', staffRouter);
// Finance — invoices, refunds, VAT summary, finance overview.
app.use('/admin', financeRouter);
// Inventory — products catalog + stock movements.
app.use('/admin', inventoryRouter);
// Loyalty — derived tiers + per-vendor customer roster.
app.use('/admin', loyaltyRouter);
app.use('/admin', adminRouter);
// Public invite accept flow (auth-only, no vendor membership required).
app.use('/staff', staffPublicRouter);

// --- 404 + error handler (must be LAST) ---
app.use(notFound);
app.use(errorMiddleware);

// --- Start ---
// We wrap Express in an HTTP server so Socket.io can attach to the same port.
const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, otp: env.OTP_DELIVERY },
    `🚀 Find My Bay API listening on http://localhost:${env.PORT}`,
  );
  // Kick off the smart-alert worker loop.
  startAlertWorker();
});
