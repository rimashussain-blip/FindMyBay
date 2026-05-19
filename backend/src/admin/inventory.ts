// Vendor admin → Inventory.
//
// Endpoints under /admin/inventory/*:
//   GET    /products                 — catalog (soft-deleted hidden)
//   POST   /products                 — create (owner/manager); seeds an
//                                       initial_stock movement when qty > 0
//   PATCH  /products/:id             — edit metadata
//   DELETE /products/:id             — soft-delete (movements stay)
//   POST   /products/:id/adjust      — bump stock (restock / adjustment /
//                                       shrinkage), writes a movement row
//   GET    /movements                — paginated log
//   GET    /low-stock                — sub-threshold products (sidebar badge)
//
// Stock writes are wrapped in a $transaction so the running balance on
// the Product row and the new StockMovement row commit together.

import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { asyncHandler, HttpError } from '../lib/error.js';
import { prisma } from '../config/db.js';
import { requireAuth } from '../auth/middleware.js';
import { requireVendor } from './middleware.js';
import { logger } from '../lib/logger.js';

export const inventoryRouter = Router();

const CATEGORIES = ['soap', 'wax', 'towel', 'consumable', 'equipment', 'other'] as const;

const productBody = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(40).optional().nullable(),
  category: z.enum(CATEGORIES).default('other'),
  unit: z.string().trim().min(1).max(16).default('pcs'),
  costAed: z.number().int().min(0).max(100_000).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).default(0),
  location: z.string().trim().max(120).nullable().optional(),
});

// Create body adds optional initialQty — when > 0 we also seed an
// 'initial_stock' movement so the audit log isn't blank.
const createBody = productBody.extend({
  initialQty: z.number().int().min(0).max(1_000_000).default(0),
});

const adjustBody = z.object({
  // Delta is signed: +5 = restock, -2 = used / shrinkage. 0 is rejected.
  delta: z.number().int().refine((n) => n !== 0, 'delta must be non-zero'),
  reason: z.enum(['restock', 'adjustment', 'shrinkage']),
  note: z.string().trim().max(280).optional(),
});

// ── Catalog ──────────────────────────────────────────────────────────────

inventoryRouter.get(
  '/inventory/products',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const rows = await prisma.product.findMany({
      where: { vendorId, deletedAt: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json({
      items: rows.map(serializeProduct),
    });
  }),
);

inventoryRouter.post(
  '/inventory/products',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = createBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const userId = req.user!.id;

    try {
      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            vendorId,
            name: body.name,
            sku: body.sku ?? null,
            category: body.category,
            unit: body.unit,
            costAed: body.costAed ?? null,
            lowStockThreshold: body.lowStockThreshold,
            location: body.location ?? null,
            stockQty: body.initialQty,
          },
        });
        if (body.initialQty > 0) {
          await tx.stockMovement.create({
            data: {
              productId: created.id,
              vendorId,
              delta: body.initialQty,
              resultingQty: body.initialQty,
              reason: 'initial_stock',
              note: 'Opening balance when product was added',
              createdById: userId,
            },
          });
        }
        return created;
      });
      logger.info({ productId: product.id, vendorId }, 'product created');
      res.status(201).json(serializeProduct(product));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new HttpError(409, 'A product with that SKU already exists', {
          code: 'sku_conflict',
        });
      }
      throw e;
    }
  }),
);

inventoryRouter.patch(
  '/inventory/products/:id',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = productBody.partial().parse(req.body);
    const vendorId = req.vendor!.id;
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, vendorId, deletedAt: null },
    });
    if (!product) throw new HttpError(404, 'Product not found', { code: 'not_found' });

    try {
      const updated = await prisma.product.update({
        where: { id: product.id },
        data: {
          ...body,
          sku: body.sku === undefined ? undefined : body.sku ?? null,
          costAed: body.costAed === undefined ? undefined : body.costAed ?? null,
          location: body.location === undefined ? undefined : body.location ?? null,
        },
      });
      res.json(serializeProduct(updated));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new HttpError(409, 'A product with that SKU already exists', {
          code: 'sku_conflict',
        });
      }
      throw e;
    }
  }),
);

inventoryRouter.delete(
  '/inventory/products/:id',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, vendorId, deletedAt: null },
    });
    if (!product) throw new HttpError(404, 'Product not found', { code: 'not_found' });
    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

// ── Stock adjustment ─────────────────────────────────────────────────────

inventoryRouter.post(
  '/inventory/products/:id/adjust',
  requireAuth,
  requireVendor('owner', 'manager', 'attendant'),
  asyncHandler(async (req, res) => {
    const body = adjustBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const userId = req.user!.id;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: req.params.id, vendorId, deletedAt: null },
      });
      if (!product) throw new HttpError(404, 'Product not found', { code: 'not_found' });

      const next = product.stockQty + body.delta;
      if (next < 0) {
        throw new HttpError(409, 'Adjustment would push stock below zero', {
          code: 'below_zero',
          details: { current: product.stockQty, delta: body.delta },
        });
      }

      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stockQty: next },
      });
      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          vendorId,
          delta: body.delta,
          resultingQty: next,
          reason: body.reason,
          note: body.note ?? null,
          createdById: userId,
        },
      });
      return { product: updated, movement };
    });

    logger.info(
      {
        productId: result.product.id,
        delta: body.delta,
        reason: body.reason,
        resultingQty: result.product.stockQty,
      },
      'stock adjusted',
    );

    res.json({
      product: serializeProduct(result.product),
      movement: serializeMovement(result.movement),
    });
  }),
);

// ── Movement log ─────────────────────────────────────────────────────────

const movementsQuery = z.object({
  productId: z.string().optional(),
  reason: z.enum(['restock', 'adjustment', 'used_in_wash', 'shrinkage', 'initial_stock']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

inventoryRouter.get(
  '/inventory/movements',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const q = movementsQuery.parse(req.query);
    const vendorId = req.vendor!.id;
    const where: Prisma.StockMovementWhereInput = { vendorId };
    if (q.productId) where.productId = q.productId;
    if (q.reason) where.reason = q.reason;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(q.from);
      if (q.to) where.createdAt.lte = new Date(q.to);
    }

    const [total, rows] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          product: { select: { name: true, unit: true, category: true } },
        },
      }),
    ]);

    res.json({
      page: q.page,
      pageSize: q.pageSize,
      total,
      items: rows.map((m) => ({
        ...serializeMovement(m),
        product: {
          name: m.product.name,
          unit: m.product.unit,
          category: String(m.product.category),
        },
      })),
    });
  }),
);

// ── Low-stock helper ─────────────────────────────────────────────────────
//
// Used by the inventory page banner + the sidebar badge (future enh).
// Returns active products where stockQty <= lowStockThreshold AND
// lowStockThreshold > 0 (threshold=0 disables the alert).

inventoryRouter.get(
  '/inventory/low-stock',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    // Prisma can't compare two columns directly in a WHERE — fall back
    // to a raw query that filters product rows by stockQty <= threshold.
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        category: string;
        unit: string;
        stock_qty: number;
        low_stock_threshold: number;
      }>
    >`
      SELECT id, name, category::text AS category, unit, stock_qty, low_stock_threshold
        FROM "products"
       WHERE "vendor_id" = ${vendorId}
         AND "deleted_at" IS NULL
         AND "low_stock_threshold" > 0
         AND "stock_qty" <= "low_stock_threshold"
       ORDER BY (stock_qty - low_stock_threshold) ASC
    `;
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        unit: r.unit,
        stockQty: r.stock_qty,
        lowStockThreshold: r.low_stock_threshold,
      })),
    });
  }),
);

// ── Serializers ──────────────────────────────────────────────────────────

function serializeProduct(p: {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  costAed: number | null;
  stockQty: number;
  lowStockThreshold: number;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: String(p.category),
    unit: p.unit,
    costAed: p.costAed,
    stockQty: p.stockQty,
    lowStockThreshold: p.lowStockThreshold,
    location: p.location,
    // Convenience flag the SPA reads to highlight the row in red. Mirrors
    // the /low-stock endpoint's filter so the two stay in sync.
    isLowStock: p.lowStockThreshold > 0 && p.stockQty <= p.lowStockThreshold,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function serializeMovement(m: {
  id: string;
  productId: string;
  delta: number;
  resultingQty: number;
  reason: string;
  note: string | null;
  bookingId: string | null;
  createdAt: Date;
}) {
  return {
    id: m.id,
    productId: m.productId,
    delta: m.delta,
    resultingQty: m.resultingQty,
    reason: String(m.reason),
    note: m.note,
    bookingId: m.bookingId,
    createdAt: m.createdAt.toISOString(),
  };
}
