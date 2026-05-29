-- Walk-in bookings.
--
-- A walk-in is a customer who shows up at the vendor without an advance
-- reservation. The vendor staff records them via POST /admin/walk-in;
-- backend creates a Booking row with:
--   * customer_id  = NULL                (no registered User)
--   * is_walk_in   = TRUE                (fast filter)
--   * walk_in_name + walk_in_phone       (optional contact captured at desk)
--   * status       = 'in_progress'       (already started)
--   * slot_start   = now() rounded down  (walk-ins start immediately)
--
-- Reuses the existing Booking pipeline so dashboards, bay-board, completion
-- flow, etc. work unchanged. Walk-ins do NOT trigger smart-alert pushes
-- (alerts only schedule for confirmed bookings with future slots) and do
-- NOT have a Payment row (cash/in-person payment is handled off-platform
-- for V1).

-- 1. Allow customer_id to be NULL.
ALTER TABLE "bookings" ALTER COLUMN "customer_id" DROP NOT NULL;

-- 2. Drop + recreate the customer FK to be nullable-friendly.
--    The original constraint is ON DELETE RESTRICT (we never delete
--    customers anyway). Same behaviour for non-null rows; null rows
--    simply have no FK to enforce.
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_customer_id_fkey";
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. New columns for walk-in metadata.
ALTER TABLE "bookings" ADD COLUMN "is_walk_in" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "bookings" ADD COLUMN "walk_in_name" TEXT;
ALTER TABLE "bookings" ADD COLUMN "walk_in_phone" TEXT;

-- 4. Helpful index for filtering walk-ins on dashboards.
CREATE INDEX "bookings_is_walk_in_idx" ON "bookings"("is_walk_in") WHERE "is_walk_in" = TRUE;
