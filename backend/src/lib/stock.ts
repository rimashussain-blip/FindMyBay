// Stock-movement helpers shared between the booking-completion auto-deduct
// hook, the PO receive flow, and the manual-adjust endpoint.
//
// Why a shared lib? Without it, the booking-status route, the PO route,
// and the inventory route would each open their own $transaction and
// write StockMovement rows by hand — easy to drift. This module keeps
// "post a stock change" in one place so the audit trail stays consistent.

import type { Prisma } from '@prisma/client';
import { logger } from './logger.js';

export type StockMovementReason =
  | 'restock'
  | 'adjustment'
  | 'used_in_wash'
  | 'shrinkage'
  | 'initial_stock';

export interface PostStockChange {
  productId: string;
  delta: number;
  reason: StockMovementReason;
  note?: string | null;
  bookingId?: string | null;
  createdById?: string | null;
}

/**
 * Apply a stock change atomically. Updates Product.stockQty and writes
 * one StockMovement row. Caller passes the active Prisma transaction
 * client so multiple changes can be batched (e.g. one PO with N items).
 *
 * Refuses to push stock below zero — throws so the caller can decide
 * how to handle (PO receive rollback, surface to UI, etc.).
 */
export async function postStockChange(
  tx: Prisma.TransactionClient,
  vendorId: string,
  change: PostStockChange,
): Promise<{ resultingQty: number }> {
  const product = await tx.product.findFirst({
    where: { id: change.productId, vendorId, deletedAt: null },
    select: { id: true, stockQty: true, name: true },
  });
  if (!product) {
    throw new Error(`Product ${change.productId} not found for vendor ${vendorId}`);
  }
  const next = product.stockQty + change.delta;
  if (next < 0) {
    throw new Error(
      `Stock for "${product.name}" would drop below zero (current ${product.stockQty}, delta ${change.delta})`,
    );
  }

  await tx.product.update({
    where: { id: product.id },
    data: { stockQty: next },
  });
  await tx.stockMovement.create({
    data: {
      productId: product.id,
      vendorId,
      delta: change.delta,
      resultingQty: next,
      reason: change.reason,
      note: change.note ?? null,
      bookingId: change.bookingId ?? null,
      createdById: change.createdById ?? null,
    },
  });
  return { resultingQty: next };
}

/**
 * Auto-deduct stock for a completed booking. Walks the service's
 * ServiceProduct recipe and posts one used_in_wash movement per
 * linked product. Failures are logged but DO NOT throw — the wash
 * already happened off-platform, we shouldn't block the booking
 * status change on inventory bookkeeping.
 *
 * Why catch instead of throw? Three failure modes worth tolerating:
 *   1. The service has no recipe yet → skip silently (V1 default)
 *   2. Stock would drop below zero → log a warn; admin fixes it later
 *   3. Product was soft-deleted after the recipe was set → log + skip
 *
 * Returns a summary so the route layer can attach it to the response
 * for debugging.
 */
export async function autoDeductForBooking(
  tx: Prisma.TransactionClient,
  args: { vendorId: string; bookingId: string; serviceId: string; userId?: string | null },
): Promise<{ deducted: Array<{ productId: string; delta: number }>; warnings: string[] }> {
  const recipe = await tx.serviceProduct.findMany({
    where: { serviceId: args.serviceId },
    select: { productId: true, qtyPerWash: true },
  });

  const deducted: Array<{ productId: string; delta: number }> = [];
  const warnings: string[] = [];

  for (const r of recipe) {
    try {
      await postStockChange(tx, args.vendorId, {
        productId: r.productId,
        delta: -r.qtyPerWash,
        reason: 'used_in_wash',
        bookingId: args.bookingId,
        createdById: args.userId ?? null,
        note: 'Auto-deducted on booking complete',
      });
      deducted.push({ productId: r.productId, delta: -r.qtyPerWash });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(msg);
      logger.warn(
        { err, bookingId: args.bookingId, productId: r.productId },
        'auto-deduct skipped',
      );
    }
  }

  return { deducted, warnings };
}
