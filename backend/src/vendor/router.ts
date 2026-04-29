// Vendor endpoints.

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/error.js';
import { requireAuth } from '../auth/middleware.js';
import { findAvailability, findNearby, getVendorDetail } from './service.js';

export const vendorRouter = Router();

const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().positive().max(50_000).default(15_000),
});

vendorRouter.get(
  '/nearby',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { lat, lng, radius } = nearbyQuery.parse(req.query);
    const items = await findNearby(lat, lng, radius);
    res.json({ items });
  }),
);

vendorRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const detail = await getVendorDetail(req.params.id);
    res.json(detail);
  }),
);

const availabilityQuery = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

vendorRouter.get(
  '/:id/availability',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { serviceId, date } = availabilityQuery.parse(req.query);
    const result = await findAvailability(req.params.id, serviceId, date);
    res.json(result);
  }),
);
