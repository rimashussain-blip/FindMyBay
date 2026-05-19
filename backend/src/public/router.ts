// Public endpoints — no auth required.
//
// Today this serves the marketing site at findmybay.ae (or wherever it ends up
// deployed) so the "Studios near you" section renders live vendor data with
// real logos instead of hand-coded HTML. As more public-facing surfaces are
// added (e.g. an embeddable widget for vendor websites, a sitemap-style
// vendor index), they should live here too.
//
// Important: do NOT add anything here that returns PII (phone, email, plate),
// owner identity, or booking data. The auth-required `/vendors/*` endpoints
// already serve the customer app for everything else.

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/error.js';
import { prisma } from '../config/db.js';

export const publicRouter = Router();

// Human display labels for the Emirate enum. Keeps the marketing site dumb
// — it just renders whatever string we send.
const EMIRATE_LABELS: Record<string, string> = {
  AbuDhabi: 'Abu Dhabi',
  Dubai: 'Dubai',
  Sharjah: 'Sharjah',
  Ajman: 'Ajman',
  UmmAlQuwain: 'Umm Al Quwain',
  RasAlKhaimah: 'Ras Al Khaimah',
  Fujairah: 'Fujairah',
};

const featuredQuery = z.object({
  limit: z.coerce.number().int().positive().max(20).default(6),
});

// GET /public/featured-vendors?limit=4
//
// Returns active, non-deleted vendors for the marketing site to render. Sorts
// vendors with a logo first (so the marketing grid looks complete even when
// some onboarded vendors haven't uploaded a logo yet), then by rating, then
// oldest-first so the order is stable across page reloads.
publicRouter.get(
  '/featured-vendors',
  asyncHandler(async (req, res) => {
    const { limit } = featuredQuery.parse(req.query);

    const vendors = await prisma.vendor.findMany({
      where: {
        status: 'active',
        deletedAt: null,
      },
      // Newest-rated first, then stable insertion order. We boost vendors
      // with a logo to the top in JS below so the orderBy stays simple.
      orderBy: [{ ratingAvg: 'desc' }, { createdAt: 'asc' }],
      take: limit,
      select: {
        id: true,
        brandName: true,
        city: true,
        emirate: true,
        logoUrl: true,
        ratingAvg: true,
      },
    });

    // Logo'd vendors first, otherwise preserve the DB order.
    const ordered = [...vendors].sort((a, b) => {
      const aHasLogo = a.logoUrl ? 1 : 0;
      const bHasLogo = b.logoUrl ? 1 : 0;
      return bHasLogo - aHasLogo;
    });

    // Cache 30 s at the edge. Short enough that vendors editing their brand
    // name / logo on the admin SPA see the change propagate to the marketing
    // page within ~30 s, long enough to absorb a normal page-load burst.
    // The payload is ~30-150 KB per logo, so the cache still matters.
    res.set('Cache-Control', 'public, max-age=30, s-maxage=30');

    res.json({
      items: ordered.map((v) => ({
        id: v.id,
        brandName: v.brandName,
        emirate: EMIRATE_LABELS[v.emirate] ?? v.emirate,
        city: v.city,
        logoUrl: v.logoUrl,
        ratingAvg: v.ratingAvg,
      })),
    });
  }),
);
