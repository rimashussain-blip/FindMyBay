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
import { bookingPayRouter, paymentRouter } from './payment/router.js';
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
app.use('/admin', adminRouter);

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
