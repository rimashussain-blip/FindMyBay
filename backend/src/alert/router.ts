// Alert endpoints — primarily for testing the smart-alert engine.
// Real alert delivery happens via FCM (push) or the worker process; these
// routes let you inspect state and trigger fires manually for the demo.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { asyncHandler, HttpError } from '../lib/error.js';
import { requireAuth } from '../auth/middleware.js';
import { fireAlertNow, processDueAlerts } from './service.js';

export const alertRouter = Router();

/** GET /alerts/active — alerts already fired but not yet acted on. */
alertRouter.get(
  '/active',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const items = await prisma.alert.findMany({
      where: {
        status: 'fired',
        booking: { customerId: req.user.id, status: { in: ['confirmed', 'alert_scheduled', 'alerted'] } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        booking: {
          include: { vendor: true, service: true, bay: true },
        },
      },
    });
    res.json({ items });
  }),
);

/** POST /alerts/test-fire-now — fire an alert immediately for the demo. */
const fireBody = z.object({ bookingId: z.string().min(1) });

alertRouter.post(
  '/test-fire-now',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bookingId } = fireBody.parse(req.body);
    const result = await fireAlertNow(bookingId);
    if (!result.fired) throw new HttpError(409, result.reason ?? 'Could not fire alert');
    res.json({ ok: true });
  }),
);

/** POST /alerts/tick — manually advance the alert worker (debug only). */
alertRouter.post(
  '/tick',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const result = await processDueAlerts();
    res.json(result);
  }),
);
