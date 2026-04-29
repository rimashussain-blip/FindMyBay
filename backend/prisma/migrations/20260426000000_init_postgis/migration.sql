-- This migration is hand-edited so that we can add the PostGIS extension and
-- the spatial geometry column on the vendors table — Prisma's data model
-- doesn't natively support PostGIS types.
--
-- Order:
--   1. Enable postgis extension.
--   2. Create enums.
--   3. Create tables (Prisma-generated portion).
--   4. Add geometry column on vendors + trigger to keep it in sync with lat/lng.
--   5. Spatial index on the geometry column.

-- 1. Extension --------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Enums ------------------------------------------------------------------
CREATE TYPE "Role" AS ENUM ('customer', 'vendor_owner', 'vendor_manager', 'attendant', 'admin');
CREATE TYPE "Emirate" AS ENUM ('AbuDhabi', 'Dubai', 'Sharjah', 'Ajman', 'UmmAlQuwain', 'RasAlKhaimah', 'Fujairah');
CREATE TYPE "VendorStatus" AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE "BayType" AS ENUM ('sedan', 'suv', 'bike');
CREATE TYPE "BayStatus" AS ENUM ('free', 'busy', 'closed');
CREATE TYPE "BookingStatus" AS ENUM (
  'pending_payment', 'confirmed', 'alert_scheduled', 'alerted',
  'in_progress', 'completed', 'cancelled', 'no_show'
);

-- 3. Tables -----------------------------------------------------------------

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "full_name" TEXT,
  "email" TEXT,
  "role" "Role" NOT NULL DEFAULT 'customer',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

CREATE TABLE "otp_challenges" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "otp_challenges_phone_created_at_idx" ON "otp_challenges"("phone", "created_at");

CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

CREATE TABLE "vendors" (
  "id" TEXT NOT NULL,
  "brand_name" TEXT NOT NULL,
  "trade_license_no" TEXT,
  "city" TEXT NOT NULL,
  "emirate" "Emirate" NOT NULL,
  "address_line" TEXT,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "logo_url" TEXT,
  "status" "VendorStatus" NOT NULL DEFAULT 'active',
  "rating_avg" DOUBLE PRECISION,
  "price_from_aed" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vendors_emirate_city_idx" ON "vendors"("emirate", "city");

CREATE TABLE "bays" (
  "id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bay_type" "BayType" NOT NULL DEFAULT 'sedan',
  "status" "BayStatus" NOT NULL DEFAULT 'free',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "bays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bays_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE
);
CREATE INDEX "bays_vendor_id_idx" ON "bays"("vendor_id");

CREATE TABLE "services" (
  "id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "duration_min" INTEGER NOT NULL,
  "price_aed" INTEGER NOT NULL,
  "vat_inclusive" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "services_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE
);
CREATE INDEX "services_vendor_id_idx" ON "services"("vendor_id");

CREATE TABLE "bookings" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "bay_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "slot_start" TIMESTAMP(3) NOT NULL,
  "slot_end" TIMESTAMP(3) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'pending_payment',
  "total_aed" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id"),
  CONSTRAINT "bookings_vendor_id_fkey"   FOREIGN KEY ("vendor_id")   REFERENCES "vendors"("id"),
  CONSTRAINT "bookings_bay_id_fkey"      FOREIGN KEY ("bay_id")      REFERENCES "bays"("id"),
  CONSTRAINT "bookings_service_id_fkey"  FOREIGN KEY ("service_id")  REFERENCES "services"("id")
);
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");
CREATE INDEX "bookings_vendor_id_slot_start_idx" ON "bookings"("vendor_id", "slot_start");

-- 4. Geometry column + trigger ---------------------------------------------
ALTER TABLE "vendors" ADD COLUMN "geom" geometry(Point, 4326);

CREATE OR REPLACE FUNCTION fmb_sync_vendor_geom() RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_sync_geom_biu
  BEFORE INSERT OR UPDATE OF lat, lng ON "vendors"
  FOR EACH ROW EXECUTE FUNCTION fmb_sync_vendor_geom();

-- 5. Spatial index ----------------------------------------------------------
CREATE INDEX vendors_geom_gist ON "vendors" USING GIST ("geom");
