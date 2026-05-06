-- Phone uniqueness scoped to customers only.
--
-- Previously: users.phone was globally unique. That meant a vendor_owner with
-- a phone (e.g. their personal contact during platform onboarding) blocked
-- any customer from claiming that same phone, even though the two roles serve
-- different functions (vendor staff log in by email/password; customers by
-- phone OTP or Google).
--
-- Now: phone is unique only among role='customer' users. Vendor staff phones
-- are stored as contact info but not enforced unique. This lets the same
-- human be both a vendor owner (one user row, email-keyed) and a customer
-- (separate user row, phone-keyed) without collision. Email remains globally
-- unique so staff identities still can't be duplicated.
--
-- Partial unique indexes aren't expressible in Prisma's @@unique syntax, so
-- we drop the auto-generated index and create the partial one in raw SQL.

DROP INDEX IF EXISTS "users_phone_key";

CREATE UNIQUE INDEX "users_customer_phone_key"
    ON "users" ("phone")
    WHERE role = 'customer' AND phone IS NOT NULL;
