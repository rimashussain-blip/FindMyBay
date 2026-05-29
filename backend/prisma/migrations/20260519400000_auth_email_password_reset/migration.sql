-- Password reset + email verification.
-- See PasswordResetToken + EmailVerification models in schema.prisma.

-- 1. User.emailVerifiedAt — null = unverified.
ALTER TABLE "users"
    ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- Back-fill: any existing user that has a googleSub or appleSub is
-- already pre-verified by the identity provider. Email/password users
-- start NULL and get a verification email on next login attempt (or
-- they can request one from settings).
UPDATE "users"
   SET "email_verified_at" = "created_at"
 WHERE "email" IS NOT NULL
   AND ("google_sub" IS NOT NULL OR "apple_sub" IS NOT NULL);

-- 2. Password reset tokens.
CREATE TABLE "password_reset_tokens" (
    "id"          TEXT PRIMARY KEY,
    "user_id"     TEXT NOT NULL,
    "token_hash"  TEXT NOT NULL UNIQUE,
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "consumed_ip" TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- 3. Email verifications.
CREATE TABLE "email_verifications" (
    "id"          TEXT PRIMARY KEY,
    "user_id"     TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "token_hash"  TEXT NOT NULL UNIQUE,
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications"("user_id");
