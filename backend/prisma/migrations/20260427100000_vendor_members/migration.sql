-- Vendor membership: ties a user to a vendor with a role (owner/manager/attendant).
-- The vendor admin endpoints use this join to authorize who can manage what.

CREATE TYPE "VendorMemberRole" AS ENUM ('owner', 'manager', 'attendant');

CREATE TABLE "vendor_members" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "role" "VendorMemberRole" NOT NULL DEFAULT 'owner',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vendor_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "vendor_members_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "vendor_members_user_id_vendor_id_key" ON "vendor_members"("user_id", "vendor_id");
CREATE INDEX "vendor_members_vendor_id_idx" ON "vendor_members"("vendor_id");
