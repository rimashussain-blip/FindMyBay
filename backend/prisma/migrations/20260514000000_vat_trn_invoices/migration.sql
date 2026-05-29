-- UAE VAT + FTA-compliant invoicing.
--
-- Adds the three columns an FTA auditor will look for:
--   1. vendors.trn_number       — the 15-digit Tax Registration Number.
--   2. vendors.last_invoice_seq — per-vendor monotonic counter for invoice
--                                 numbers. Incremented atomically via
--                                 `assignInvoiceNumber` so the sequence is
--                                 non-skipped under concurrent writes.
--   3. bookings.vat_aed         — VAT component of total_aed in whole AED.
--   4. bookings.invoice_number  — unique, sequential invoice id issued when
--                                 the booking becomes billable (payment
--                                 success for app bookings, immediate for
--                                 walk-ins).
--
-- Historical totals already include VAT for vat_inclusive services, so we
-- back-derive the VAT component for those rows. For non-inclusive services
-- (rare in V1 — most studios price VAT-in) we leave vat_aed at 0 since the
-- existing total_aed already excluded VAT and never billed it.

-- 1. Vendor: TRN + invoice sequence
ALTER TABLE "vendors" ADD COLUMN "trn_number" TEXT;
ALTER TABLE "vendors" ADD COLUMN "last_invoice_seq" INTEGER NOT NULL DEFAULT 0;

-- 2. Booking: VAT line + invoice number
ALTER TABLE "bookings" ADD COLUMN "vat_aed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN "invoice_number" TEXT;

-- Unique index so two vendors can't accidentally clash and so the column
-- can be used as a stable receipt identifier in customer-facing flows.
CREATE UNIQUE INDEX "bookings_invoice_number_key" ON "bookings"("invoice_number");

-- 3. Backfill historical VAT for vat-inclusive services
--    Formula: vat = round(total * 5 / 105).
--    Postgres ROUND on numeric is banker's-rounding-free (standard half-up
--    is what we want for currency), and ::int trims to whole AED.
UPDATE "bookings" b
SET "vat_aed" = ROUND(b."total_aed" * 5.0 / 105.0)::int
FROM "services" s
WHERE b."service_id" = s."id" AND s."vat_inclusive" = TRUE;
