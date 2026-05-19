// Invoice number assignment.
//
// UAE FTA rules require tax invoices to carry a unique sequential number
// per issuing entity, with no skips. We track this with a per-vendor
// counter (`Vendor.lastInvoiceSeq`) and increment it atomically inside
// the same transaction that flips the booking into a billable state — so
// concurrent payments can't race the counter into reusing or skipping a
// number.
//
// Number format is `{vendorPrefix}-{seq:06d}`, e.g. `POL-000042`. The
// vendor prefix is derived from the brand name (first 3 alphabetic chars,
// upper-cased; "INV" as a fallback if the brand has no letters).

import type { Prisma } from '@prisma/client';

/**
 * Claim the next invoice number for [vendorId] and stamp it onto the
 * given booking. MUST be called inside an active transaction so the
 * counter bump and booking update commit atomically.
 */
export async function assignInvoiceNumber(
  tx: Prisma.TransactionClient,
  vendorId: string,
  bookingId: string,
): Promise<string> {
  // Atomic increment + read. Under concurrent writes Postgres takes a
  // row-level lock so each caller gets a distinct post-increment value.
  const v = await tx.vendor.update({
    where: { id: vendorId },
    data: { lastInvoiceSeq: { increment: 1 } },
    select: { lastInvoiceSeq: true, brandName: true },
  });

  const prefix = vendorPrefix(v.brandName);
  const number = `${prefix}-${String(v.lastInvoiceSeq).padStart(6, '0')}`;

  await tx.booking.update({
    where: { id: bookingId },
    data: { invoiceNumber: number },
  });

  return number;
}

function vendorPrefix(brandName: string): string {
  const letters = brandName.replace(/[^a-zA-Z]/g, '');
  return (letters.slice(0, 3) || 'INV').toUpperCase();
}

/**
 * Claim the next credit-note number for [vendorId]. Used by the refund
 * recorder to mint FTA-compliant sequential credit notes. Format:
 *   `{vendorPrefix}-CN-{seq:06d}` — distinct from invoice numbers so the
 * two can be told apart at a glance on the dashboard. MUST be called
 * inside an active transaction.
 */
export async function assignCreditNoteNumber(
  tx: Prisma.TransactionClient,
  vendorId: string,
): Promise<string> {
  const v = await tx.vendor.update({
    where: { id: vendorId },
    data: { lastCreditNoteSeq: { increment: 1 } },
    select: { lastCreditNoteSeq: true, brandName: true },
  });
  const prefix = vendorPrefix(v.brandName);
  return `${prefix}-CN-${String(v.lastCreditNoteSeq).padStart(6, '0')}`;
}
