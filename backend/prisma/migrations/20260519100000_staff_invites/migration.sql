-- Staff invites + soft-suspend on VendorMember.
-- See the StaffInvite + VendorMemberStatus models in schema.prisma.
--
-- The owner-facing flow:
--   1. Owner POSTs /admin/staff/invite with email + role.
--   2. Backend creates a StaffInvite row with a single-use token + 14d expiry.
--   3. Owner copies the resulting URL and shares it with the invitee
--      (email service comes later in Batch D; for V1 it's manual).
--   4. Invitee visits /accept-invite/:token, signs in or signs up, the
--      backend creates a VendorMember row + marks the invite accepted.

-- 1. VendorMember.status (soft-suspend)
CREATE TYPE "VendorMemberStatus" AS ENUM ('active', 'suspended');
ALTER TABLE "vendor_members"
    ADD COLUMN "status" "VendorMemberStatus" NOT NULL DEFAULT 'active';

-- 2. StaffInvite table
CREATE TYPE "StaffInviteStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE "staff_invites" (
    "id"             TEXT PRIMARY KEY,
    "vendor_id"      TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    "role"           "VendorMemberRole" NOT NULL,
    "token"          TEXT NOT NULL UNIQUE,
    "invited_by_id"  TEXT,
    "status"         "StaffInviteStatus" NOT NULL DEFAULT 'pending',
    "expires_at"     TIMESTAMP(3) NOT NULL,
    "accepted_at"    TIMESTAMP(3),
    "accepted_by_id" TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invites_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "staff_invites_vendor_id_status_idx" ON "staff_invites"("vendor_id", "status");
CREATE INDEX "staff_invites_email_idx"            ON "staff_invites"("email");
