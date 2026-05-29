-- Google Sign-In: link Google account `sub` (subject id) to a user.
-- Treated as authoritative Google identity (email can change at Google's end,
-- sub is stable). Nullable so existing phone-OTP / email-password users
-- aren't affected.

ALTER TABLE "users" ADD COLUMN "google_sub" TEXT;
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");
