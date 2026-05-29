-- Forces a set-new-password step for staff created with a temporary password.
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
