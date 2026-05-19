-- v1.1: Telr refund processor-ref + Payouts model.
-- See Refund.processorRef + Payout model in schema.prisma.

-- 1. Refund.processorRef — tracks the Telr/mock transaction id when the
--    refund route called the processor to reverse the charge.
ALTER TABLE "refunds"
    ADD COLUMN "processor_ref" TEXT;

-- 2. Payouts.
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'paid');

CREATE TABLE "payouts" (
    "id"                  TEXT PRIMARY KEY,
    "vendor_id"           TEXT NOT NULL,
    "period_start"        TIMESTAMP(3) NOT NULL,
    "period_end"          TIMESTAMP(3) NOT NULL,
    "gross_aed"           INTEGER NOT NULL,
    "refunds_aed"         INTEGER NOT NULL DEFAULT 0,
    "vat_aed"             INTEGER NOT NULL DEFAULT 0,
    "fees_aed"            INTEGER NOT NULL DEFAULT 0,
    "net_to_vendor_aed"   INTEGER NOT NULL,
    "booking_count"       INTEGER NOT NULL DEFAULT 0,
    "status"              "PayoutStatus" NOT NULL DEFAULT 'pending',
    "paid_at"             TIMESTAMP(3),
    "paid_external_ref"   TEXT,
    "notes"               TEXT,
    "created_by_id"       TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payouts_vendor_id_period_end_idx" ON "payouts"("vendor_id", "period_end");
