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
import { postStockChange } from '../lib/stock.js';

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

// ── Service recipes (auto-deduct linking) ────────────────────────────────
//
// GET /admin/services/:id/products       — current recipe for a service
// PUT /admin/services/:id/products       — replace the entire recipe (atomic
//                                          delete + create so add/remove
//                                          happens in one call)
//
// The booking-status route imports `autoDeductForBooking` from lib/stock.ts
// which walks this recipe when status flips to 'completed'.

const recipeBody = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qtyPerWash: z.number().int().min(1).max(1000),
      }),
    )
    .max(50),
});

inventoryRouter.get(
  '/services/:id/products',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const service = await prisma.service.findFirst({
      where: { id: req.params.id, vendorId, deletedAt: null },
    });
    if (!service) throw new HttpError(404, 'Service not found', { code: 'not_found' });

    const items = await prisma.serviceProduct.findMany({
      where: { serviceId: service.id },
      include: {
        product: {
          select: { id: true, name: true, unit: true, stockQty: true, category: true, deletedAt: true },
        },
      },
    });
    res.json({
      serviceId: service.id,
      items: items
        // Hide rows where the linked product was soft-deleted; the recipe
        // still applies (will silently skip at auto-deduct time) but the
        // UI shouldn't surface tombstoned products.
        .filter((i) => !i.product.deletedAt)
        .map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          unit: i.product.unit,
          category: String(i.product.category),
          stockQty: i.product.stockQty,
          qtyPerWash: i.qtyPerWash,
        })),
    });
  }),
);

inventoryRouter.put(
  '/services/:id/products',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = recipeBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const service = await prisma.service.findFirst({
      where: { id: req.params.id, vendorId, deletedAt: null },
    });
    if (!service) throw new HttpError(404, 'Service not found', { code: 'not_found' });

    // Validate every productId actually belongs to this vendor before
    // touching any rows — avoids partial writes.
    const productIds = body.items.map((i) => i.productId);
    if (productIds.length > 0) {
      const owned = await prisma.product.count({
        where: { id: { in: productIds }, vendorId, deletedAt: null },
      });
      if (owned !== productIds.length) {
        throw new HttpError(400, 'One or more products are unknown or archived', {
          code: 'invalid_product_ref',
        });
      }
    }

    await prisma.$transaction([
      prisma.serviceProduct.deleteMany({ where: { serviceId: service.id } }),
      prisma.serviceProduct.createMany({
        data: body.items.map((i) => ({
          serviceId: service.id,
          productId: i.productId,
          qtyPerWash: i.qtyPerWash,
        })),
        skipDuplicates: true,
      }),
    ]);
    res.json({ serviceId: service.id, count: body.items.length });
  }),
);

// ── Suppliers ────────────────────────────────────────────────────────────

const supplierBody = z.object({
  name: z.string().trim().min(1).max(120),
  contactName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().email().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

inventoryRouter.get(
  '/inventory/suppliers',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const rows = await prisma.supplier.findMany({
      where: { vendorId: req.vendor!.id, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    res.json({ items: rows.map(serializeSupplier) });
  }),
);

inventoryRouter.post(
  '/inventory/suppliers',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = supplierBody.parse(req.body);
    const supplier = await prisma.supplier.create({
      data: {
        vendorId: req.vendor!.id,
        name: body.name,
        contactName: body.contactName ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        notes: body.notes ?? null,
      },
    });
    res.status(201).json(serializeSupplier(supplier));
  }),
);

inventoryRouter.patch(
  '/inventory/suppliers/:id',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = supplierBody.partial().parse(req.body);
    const vendorId = req.vendor!.id;
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, vendorId, deletedAt: null },
    });
    if (!supplier) throw new HttpError(404, 'Supplier not found', { code: 'not_found' });
    const updated = await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        ...body,
        contactName: body.contactName === undefined ? undefined : body.contactName ?? null,
        phone: body.phone === undefined ? undefined : body.phone ?? null,
        email: body.email === undefined ? undefined : body.email ?? null,
        notes: body.notes === undefined ? undefined : body.notes ?? null,
      },
    });
    res.json(serializeSupplier(updated));
  }),
);

inventoryRouter.delete(
  '/inventory/suppliers/:id',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, vendorId, deletedAt: null },
    });
    if (!supplier) throw new HttpError(404, 'Supplier not found', { code: 'not_found' });
    // Refuse if any non-terminal POs still reference this supplier.
    const openPos = await prisma.purchaseOrder.count({
      where: { supplierId: supplier.id, status: { in: ['draft', 'submitted'] } },
    });
    if (openPos > 0) {
      throw new HttpError(409, 'Close or cancel open POs before archiving this supplier', {
        code: 'supplier_in_use',
      });
    }
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

function serializeSupplier(s: {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: s.id,
    name: s.name,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  };
}

// ── Purchase orders ──────────────────────────────────────────────────────
//
// State machine:
//   draft     —> submitted     (owner ready to send to supplier)
//   submitted —> received      (delivery arrived; auto-restock fires)
//   draft     —> cancelled     (nothing happened; soft abort)
//   submitted —> cancelled     (didn't arrive; soft abort, no stock move)
//
// Receiving is the only path that mutates inventory — it walks the items
// and posts one StockMovement (reason='restock') per line.

const poItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(100_000),
  unitCostAed: z.number().int().min(0).max(100_000),
});

const createPoBody = z.object({
  supplierId: z.string().min(1),
  expectedAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(poItemSchema).min(1).max(100),
});

const updatePoBody = z.object({
  supplierId: z.string().min(1).optional(),
  expectedAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(poItemSchema).min(1).max(100).optional(),
});

inventoryRouter.get(
  '/inventory/purchase-orders',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const statusFilter = z
      .enum(['draft', 'submitted', 'received', 'cancelled'])
      .optional()
      .parse(req.query.status);

    const rows = await prisma.purchaseOrder.findMany({
      where: { vendorId, ...(statusFilter ? { status: statusFilter } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
      },
    });
    res.json({ items: rows.map(serializePo) });
  }),
);

inventoryRouter.post(
  '/inventory/purchase-orders',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = createPoBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const userId = req.user!.id;

    // Validate supplier + products belong to this vendor.
    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, vendorId, deletedAt: null },
    });
    if (!supplier) throw new HttpError(400, 'Unknown supplier', { code: 'invalid_supplier' });

    const productIds = body.items.map((i) => i.productId);
    const owned = await prisma.product.count({
      where: { id: { in: productIds }, vendorId, deletedAt: null },
    });
    if (owned !== productIds.length) {
      throw new HttpError(400, 'One or more products are unknown or archived', {
        code: 'invalid_product_ref',
      });
    }

    const totalAed = body.items.reduce((s, i) => s + i.qty * i.unitCostAed, 0);

    const po = await prisma.$transaction(async (tx) => {
      // Mint the PO reference using the vendor's lastPoSeq counter.
      const v = await tx.vendor.update({
        where: { id: vendorId },
        data: { lastPoSeq: { increment: 1 } },
        select: { lastPoSeq: true },
      });
      const reference = `PO-${String(v.lastPoSeq).padStart(6, '0')}`;

      const created = await tx.purchaseOrder.create({
        data: {
          vendorId,
          supplierId: supplier.id,
          reference,
          status: 'draft',
          expectedAt: body.expectedAt ? new Date(body.expectedAt) : null,
          notes: body.notes ?? null,
          totalAed,
          createdById: userId,
          items: {
            create: body.items.map((i) => ({
              productId: i.productId,
              qty: i.qty,
              unitCostAed: i.unitCostAed,
            })),
          },
        },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      });
      return created;
    });

    logger.info({ poId: po.id, reference: po.reference, totalAed }, 'PO drafted');
    res.status(201).json(serializePo(po));
  }),
);

inventoryRouter.patch(
  '/inventory/purchase-orders/:id',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const body = updatePoBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, vendorId },
    });
    if (!po) throw new HttpError(404, 'PO not found', { code: 'not_found' });
    if (po.status !== 'draft') {
      throw new HttpError(409, `Can only edit draft POs (this one is ${po.status})`, {
        code: 'po_locked',
      });
    }

    if (body.items) {
      // Re-validate product ownership when the items list changes.
      const productIds = body.items.map((i) => i.productId);
      const owned = await prisma.product.count({
        where: { id: { in: productIds }, vendorId, deletedAt: null },
      });
      if (owned !== productIds.length) {
        throw new HttpError(400, 'One or more products are unknown or archived', {
          code: 'invalid_product_ref',
        });
      }
    }

    const totalAed = body.items ? body.items.reduce((s, i) => s + i.qty * i.unitCostAed, 0) : po.totalAed;

    const updated = await prisma.$transaction(async (tx) => {
      if (body.items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id } });
        await tx.purchaseOrderItem.createMany({
          data: body.items.map((i) => ({
            purchaseOrderId: po.id,
            productId: i.productId,
            qty: i.qty,
            unitCostAed: i.unitCostAed,
          })),
        });
      }
      return tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          supplierId: body.supplierId ?? undefined,
          expectedAt:
            body.expectedAt === undefined
              ? undefined
              : body.expectedAt === null
                ? null
                : new Date(body.expectedAt),
          notes: body.notes === undefined ? undefined : body.notes ?? null,
          totalAed,
        },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      });
    });

    res.json(serializePo(updated));
  }),
);

inventoryRouter.post(
  '/inventory/purchase-orders/:id/submit',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, vendorId },
    });
    if (!po) throw new HttpError(404, 'PO not found', { code: 'not_found' });
    if (po.status !== 'draft') {
      throw new HttpError(409, `Only drafts can be submitted (this one is ${po.status})`, {
        code: 'po_locked',
      });
    }
    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'submitted' },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    });
    res.json(serializePo(updated));
  }),
);

inventoryRouter.post(
  '/inventory/purchase-orders/:id/receive',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const userId = req.user!.id;
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, vendorId },
      include: { items: true },
    });
    if (!po) throw new HttpError(404, 'PO not found', { code: 'not_found' });
    if (po.status !== 'submitted') {
      throw new HttpError(409, `Only submitted POs can be received (this one is ${po.status})`, {
        code: 'po_not_submitted',
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Post one restock movement per line item. postStockChange throws
      // on a below-zero result (impossible for restocks) and on a
      // missing product (defensive — products can't be hard-deleted).
      for (const item of po.items) {
        await postStockChange(tx, vendorId, {
          productId: item.productId,
          delta: item.qty,
          reason: 'restock',
          note: `Received via ${po.reference}`,
          createdById: userId,
        });
      }
      return tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'received', receivedAt: new Date() },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      });
    });

    logger.info(
      { poId: updated.id, reference: updated.reference, items: po.items.length },
      'PO received, stock restocked',
    );
    res.json(serializePo(updated));
  }),
);

inventoryRouter.post(
  '/inventory/purchase-orders/:id/cancel',
  requireAuth,
  requireVendor('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, vendorId },
    });
    if (!po) throw new HttpError(404, 'PO not found', { code: 'not_found' });
    if (po.status === 'received' || po.status === 'cancelled') {
      throw new HttpError(409, `Can't cancel a ${po.status} PO`, { code: 'po_terminal' });
    }
    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'cancelled' },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    });
    res.json(serializePo(updated));
  }),
);

function serializePo(p: {
  id: string;
  reference: string;
  status: string;
  expectedAt: Date | null;
  receivedAt: Date | null;
  totalAed: number;
  notes: string | null;
  createdAt: Date;
  supplier: { id: string; name: string };
  items: Array<{
    id: string;
    productId: string;
    qty: number;
    unitCostAed: number;
    product: { name: string; unit: string };
  }>;
}) {
  return {
    id: p.id,
    reference: p.reference,
    status: String(p.status),
    expectedAt: p.expectedAt?.toISOString() ?? null,
    receivedAt: p.receivedAt?.toISOString() ?? null,
    totalAed: p.totalAed,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
    supplier: p.supplier,
    items: p.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      unit: i.product.unit,
      qty: i.qty,
      unitCostAed: i.unitCostAed,
      lineTotalAed: i.qty * i.unitCostAed,
    })),
  };
}
