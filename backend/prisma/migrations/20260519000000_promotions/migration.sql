-- Promotions: vendor-scoped (or platform-wide) discount codes that
-- customers apply at booking-create. See the Promotion + PromotionRedemption
-- models in schema.prisma for field-level intent.
--
-- The discount is realised by knocking AED off the booking's total_aed at
-- create time. We store the realised discount on the booking row
-- (discount_aed) and the FK to the promo (promotion_id) so the receipt
-- line + dashboards reconcile to a single source.

-- 1. PromotionType / PromotionStatus enums
CREATE TYPE "PromotionType" AS ENUM ('percent', 'fixed', 'bundle');
CREATE TYPE "PromotionStatus" AS ENUM ('active', 'scheduled', 'paused', 'expired', 'archived');

-- 2. Promotions table
CREATE TABLE "promotions" (
    "id"                       TEXT PRIMARY KEY,
    "vendor_id"                TEXT,
    "name"                     TEXT NOT NULL,
    "code"                     TEXT NOT NULL,
    "type"                     "PromotionType" NOT NULL,
    "value"                    INTEGER NOT NULL,
    "applicable_service_ids"   TEXT[] NOT NULL DEFAULT '{}',
    "applicable_car_types"     "CarType"[] NOT NULL DEFAULT '{}',
    "min_spend_aed"            INTEGER,
    "starts_at"                TIMESTAMP(3) NOT NULL,
    "ends_at"                  TIMESTAMP(3) NOT NULL,
    "usage_limit"              INTEGER NOT NULL DEFAULT 0,
    "per_customer_limit"       INTEGER NOT NULL DEFAULT 1,
    "auto_applied"             BOOLEAN NOT NULL DEFAULT FALSE,
    "featured"                 BOOLEAN NOT NULL DEFAULT FALSE,
    "terms"                    TEXT,
    "status"                   "PromotionStatus" NOT NULL DEFAULT 'active',
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at"              TIMESTAMP(3),

    CONSTRAINT "promotions_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Uniqueness: same vendor can't reuse a code. (vendor_id IS NULL groups
-- as a single bucket for platform-wide promos.)
CREATE UNIQUE INDEX "promotions_vendor_id_code_key" ON "promotions"("vendor_id", "code");
CREATE INDEX "promotions_vendor_id_status_idx" ON "promotions"("vendor_id", "status");
CREATE INDEX "promotions_ends_at_idx"          ON "promotions"("ends_at");

-- 3. Booking columns
ALTER TABLE "bookings" ADD COLUMN "promotion_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN "discount_aed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_promotion_id_fkey"
    FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "bookings_promotion_id_idx" ON "bookings"("promotion_id");

-- 4. Promotion redemptions
CREATE TABLE "promotion_redemptions" (
    "id"              TEXT PRIMARY KEY,
    "promotion_id"    TEXT NOT NULL,
    "booking_id"      TEXT NOT NULL UNIQUE,
    "customer_id"     TEXT,
    "amount_off_aed"  INTEGER NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemptions_promotion_id_fkey"
        FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promotion_redemptions_booking_id_fkey"
        FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "promotion_redemptions_promotion_id_idx" ON "promotion_redemptions"("promotion_id");
CREATE INDEX "promotion_redemptions_customer_id_idx"  ON "promotion_redemptions"("customer_id");
