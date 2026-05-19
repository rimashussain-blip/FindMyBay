-- Refunds + credit-note sequence on Vendor.
-- See the Refund model + RefundStatus enum in schema.prisma.
--
-- V1 records refunds out-of-band — vendor staff issues the actual
-- refund via their card terminal / cash drawer, then logs the act
-- here so finance / VAT / credit-note trail stay accurate.

-- 1. Vendor.lastCreditNoteSeq counter (parallel to lastInvoiceSeq).
ALTER TABLE "vendors"
    ADD COLUMN "last_credit_note_seq" INTEGER NOT NULL DEFAULT 0;

-- 2. Refund table.
CREATE TYPE "RefundStatus" AS ENUM ('processed', 'voided');

CREATE TABLE "refunds" (
    "id"                 TEXT PRIMARY KEY,
    "booking_id"         TEXT NOT NULL,
    "vendor_id"          TEXT NOT NULL,
    "amount_aed"         INTEGER NOT NULL,
    "vat_aed"            INTEGER NOT NULL DEFAULT 0,
    "reason"             TEXT NOT NULL,
    "status"             "RefundStatus" NOT NULL DEFAULT 'processed',
    "credit_note_number" TEXT UNIQUE,
    "created_by_id"      TEXT,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_booking_id_fkey"
        FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "refunds_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "refunds_vendor_id_created_at_idx" ON "refunds"("vendor_id", "created_at");
CREATE INDEX "refunds_booking_id_idx"           ON "refunds"("booking_id");
