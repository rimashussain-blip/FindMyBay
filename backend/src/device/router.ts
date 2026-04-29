// Device token registration for FCM + customer location reporting.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { asyncHandler, HttpError } from '../lib/error.js';
import { requireAuth } from '../auth/middleware.js';

export const deviceRouter = Router();

const registerBody = z.object({
  fcmToken: z.string().min(20),
  platform: z.enum(['android', 'ios']).default('android'),
});

/** POST /devices/register — upsert FCM token bound to current user. */
deviceRouter.post(
  '/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const { fcmToken, platform } = registerBody.parse(req.body);

    await prisma.deviceToken.upsert({
      where: { fcmToken },
      update: { userId: req.user.id, lastSeenAt: new Date(), platform },
      create: { userId: req.user.id, fcmToken, platform },
    });

    res.json({ ok: true });
  }),
);

const locationBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative().max(100_000).optional(),
});

/**
 * POST /devices/location — customer app pushes its current GPS reading.
 *
 * Stored on the user row (not history) so the smart-alert worker can read
 * one row at compute time. Throttling lives client-side (the app sends
 * every ~90 s while foregrounded with an active booking).
 */
deviceRouter.post(
  '/location',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const { lat, lng } = locationBody.parse(req.body);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
