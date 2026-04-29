-- Replace partial unique indexes on users.email and users.phone with regular
-- unique indexes. Partial indexes don't satisfy Postgres ON CONFLICT clauses,
-- which Prisma's `upsert` relies on. Regular unique indexes still permit
-- multiple NULL values (Postgres treats NULLs as distinct by default), so
-- we get the same logical behaviour without breaking upserts.

DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

DROP INDEX IF EXISTS "users_phone_key";
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
