-- Add email + password auth alongside the existing phone OTP flow.
-- Phone becomes nullable so vendor admin users can sign up with email only.

ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;

-- Unique constraints on phone (already in place) + email
DROP INDEX IF EXISTS "users_phone_key";
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone") WHERE "phone" IS NOT NULL;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email") WHERE "email" IS NOT NULL;
