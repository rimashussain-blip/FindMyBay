-- Apple Sign-In support.
--
-- Adds an `apple_sub` column to users. Stored as a unique nullable string
-- matching `google_sub` semantics — set when a user first signs in via
-- Sign in with Apple, and used to look up the same user on every
-- subsequent sign-in. Email can rotate (Hide My Email) so `sub` is the
-- stable identity anchor.

ALTER TABLE "users" ADD COLUMN "apple_sub" TEXT;

-- Partial uniqueness — NULLs are allowed but if a sub is present it must
-- be unique across the table.
CREATE UNIQUE INDEX "users_apple_sub_key" ON "users"("apple_sub")
  WHERE "apple_sub" IS NOT NULL;
