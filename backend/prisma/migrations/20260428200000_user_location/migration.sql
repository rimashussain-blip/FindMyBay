-- Last-known device location per user, posted by the customer app.
-- Used by the smart-alert worker to compute ETA against vendor coords.

ALTER TABLE "users" ADD COLUMN "last_lat" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "last_lng" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "last_location_at" TIMESTAMP(3);
