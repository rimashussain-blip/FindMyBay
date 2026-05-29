// Vendor admin → Promotions routes.
//
// Endpoints (all gated to the authenticated vendor's owner/manager):
//
//   GET    /admin/promotions               — list, ?tab=active|scheduled|expired
//   POST   /admin/promotions               — create
//   GET    /admin/promotions/:id           — detail (with redemption stats)
//   PATCH  /admin/promotions/:id           — edit
//   POST   /admin/promotions/:id/pause     — flip status to 'paused'
//   POST   /admin/promotions/:id/resume    — flip status back to 'active'
//   POST   /admin/promotions/:id/archive   — soft delete (status='archived',
//                                            archivedAt=now); promotion can no
//                                            longer be applied but existing
//                                            redemptions on past bookings stay.
//
// The customer-facing apply path lives in src/booking — see promo helper
// in src/lib/promo.ts.

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../lib/error.js';
import { prisma } from '../config/db.js';
import { requireAuth } from '../auth/middleware.js';
import { requireVendor } from './middleware.js';
import { derivedPromoStatus, promoTabWhere } from '../lib/promo.js';
import { logger } from '../lib/logger.js';

export const promotionsRouter = Router();

// Common validators
const HHmm = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
const promoCode = z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase letters, digits, _ or -');
const promoType = z.enum(['percent', 'fixed', 'bundle']);

const createBody = z.object({
  name: z.string().min(1).max(120),
  code: promoCode,
  type: promoType,
  // 1-100 for percent (capped at 100), 1+ for fixed AED. Bundle ignores value.
  value: z.number().int().min(0).max(1000),
  applicableServiceIds: z.array(z.string()).default([]),
  applicableCarTypes: z
    .array(z.enum(['sedan', 'hatchback', 'suv', 'pickup', 'van', 'coupe', 'other']))
    .default([]),
  minSpendAed: z.number().int().nonnegative().nullable().optional(),
  startsAt: HHmm,
  endsAt: HHmm,
  usageLimit: z.number().int().nonnegative().default(0),
  perCustomerLimit: z.number().int().nonnegative().default(1),
  autoApplied: z.boolean().default(false),
  featured: z.boolean().default(false),
  terms: z.string().max(1000).nullable().optional(),
});

const editBody = createBody.partial();

const tabQuery = z.object({
  tab: z.enum(['active', 'scheduled', 'expired']).default('active'),
});

// ── GET /admin/promotions ────────────────────────────────────────────────
promotionsRouter.get(
  '/promotions',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const { tab } = tabQuery.parse(req.query);
    const vendorId = req.vendor!.id;

    const promos = await prisma.promotion.findMany({
      where: { vendorId, ...promoTabWhere(tab) },
      orderBy: [{ status: 'asc' }, { endsAt: 'asc' }],
      include: {
        _count: { select: { redemptions: true } },
        redemptions: {
          select: { amountOffAed: true },
        },
      },
    });

    res.json({
      tab,
      counts: await countByTab(vendorId),
      items: promos.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        type: String(p.type),
        value: p.value,
        applicableServiceIds: p.applicableServiceIds,
        applicableCarTypes: p.applicableCarTypes.map(String),
        minSpendAed: p.minSpendAed,
        startsAt: p.startsAt.toISOString(),
        endsAt: p.endsAt.toISOString(),
        usageLimit: p.usageLimit,
        perCustomerLimit: p.perCustomerLimit,
        autoApplied: p.autoApplied,
        featured: p.featured,
        terms: p.terms,
        status: derivedPromoStatus(p),
        used: p._count.redemptions,
        // Revenue impact ≈ AED knocked off via this promo. Vendors think of
        // it as "promo-driven incremental revenue"; the closer modelling is
        // out of scope for V1 — surfacing the redemption sum is enough.
        amountOffAedTotal: p.redemptions.reduce((s, r) => s + r.amountOffAed, 0),
      })),
    });
  }),
);

// ── POST /admin/promotions ───────────────────────────────────────────────
promotionsRouter.post(
  '/promotions',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = createBody.parse(req.body);
    const vendorId = req.vendor!.id;

    if (new Date(body.endsAt).getTime() <= new Date(body.startsAt).getTime()) {
      throw new HttpError(400, 'endsAt must be after startsAt', { code: 'invalid_window' });
    }

    const promo = await prisma.promotion
      .create({
        data: {
          vendorId,
          name: body.name.trim(),
          code: body.code.trim().toUpperCase(),
          type: body.type,
          value: body.value,
          applicableServiceIds: body.applicableServiceIds,
          applicableCarTypes: body.applicableCarTypes,
          minSpendAed: body.minSpendAed ?? null,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
          usageLimit: body.usageLimit,
          perCustomerLimit: body.perCustomerLimit,
          autoApplied: body.autoApplied,
          featured: body.featured,
          terms: body.terms ?? null,
        },
      })
      .catch((e: unknown) => {
        if (
          typeof e === 'object' &&
          e !== null &&
          'code' in e &&
          (e as { code: string }).code === 'P2002'
        ) {
          throw new HttpError(409, 'A promotion with that code already exists', {
            code: 'duplicate_code',
          });
        }
        throw e;
      });

    logger.info({ promotionId: promo.id, vendorId }, 'promo created');
    res.status(201).json(toDto(promo, 0, 0));
  }),
);

// ── GET /admin/promotions/:id ────────────────────────────────────────────
promotionsRouter.get(
  '/promotions/:id',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const promo = await prisma.promotion.findFirst({
      where: { id: req.params.id, vendorId },
      include: {
        _count: { select: { redemptions: true } },
        redemptions: { select: { amountOffAed: true } },
      },
    });
    if (!promo) throw new HttpError(404, 'Promotion not found', { code: 'not_found' });
    res.json(
      toDto(
        promo,
        promo._count.redemptions,
        promo.redemptions.reduce((s, r) => s + r.amountOffAed, 0),
      ),
    );
  }),
);

// ── PATCH /admin/promotions/:id ──────────────────────────────────────────
promotionsRouter.patch(
  '/promotions/:id',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = editBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const existing = await prisma.promotion.findFirst({
      where: { id: req.params.id, vendorId },
    });
    if (!existing) throw new HttpError(404, 'Promotion not found', { code: 'not_found' });

    const updated = await prisma.promotion.update({
      where: { id: existing.id },
      data: {
        name: body.name?.trim(),
        code: body.code?.trim().toUpperCase(),
        type: body.type,
        value: body.value,
        applicableServiceIds: body.applicableServiceIds,
        applicableCarTypes: body.applicableCarTypes,
        minSpendAed: body.minSpendAed === undefined ? undefined : body.minSpendAed,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        usageLimit: body.usageLimit,
        perCustomerLimit: body.perCustomerLimit,
        autoApplied: body.autoApplied,
        featured: body.featured,
        terms: body.terms === undefined ? undefined : body.terms,
      },
    });
    res.json(toDto(updated, 0, 0));
  }),
);

// ── POST /admin/promotions/:id/pause | resume | archive ──────────────────
for (const action of ['pause', 'resume', 'archive'] as const) {
  promotionsRouter.post(
    `/promotions/:id/${action}`,
    requireAuth,
    requireVendor('owner', 'manager'),
    asyncHandler(async (req, res) => {
      const vendorId = req.vendor!.id;
      const existing = await prisma.promotion.findFirst({
        where: { id: req.params.id, vendorId },
      });
      if (!existing) throw new HttpError(404, 'Promotion not found', { code: 'not_found' });

      const data =
        action === 'pause'
          ? { status: 'paused' as const }
          : action === 'resume'
            ? { status: 'active' as const }
            : { status: 'archived' as const, archivedAt: new Date() };

      const updated = await prisma.promotion.update({
        where: { id: existing.id },
        data,
      });
      res.json(toDto(updated, 0, 0));
    }),
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

async function countByTab(vendorId: string) {
  const [active, scheduled, expired] = await Promise.all([
    prisma.promotion.count({ where: { vendorId, ...promoTabWhere('active') } }),
    prisma.promotion.count({ where: { vendorId, ...promoTabWhere('scheduled') } }),
    prisma.promotion.count({ where: { vendorId, ...promoTabWhere('expired') } }),
  ]);
  return { active, scheduled, expired };
}

function toDto(
  p: Awaited<ReturnType<typeof prisma.promotion.findFirstOrThrow>>,
  used: number,
  amountOffAedTotal: number,
) {
  return {
    id: p.id,
    vendorId: p.vendorId,
    name: p.name,
    code: p.code,
    type: String(p.type),
    value: p.value,
    applicableServiceIds: p.applicableServiceIds,
    applicableCarTypes: p.applicableCarTypes.map(String),
    minSpendAed: p.minSpendAed,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    usageLimit: p.usageLimit,
    perCustomerLimit: p.perCustomerLimit,
    autoApplied: p.autoApplied,
    featured: p.featured,
    terms: p.terms,
    status: derivedPromoStatus(p),
    used,
    amountOffAedTotal,
  };
}
