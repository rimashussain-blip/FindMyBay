-- Hard cap: max 12 Distance Matrix calls per booking (spec §10.4).
-- Tracked on the alert row so it survives backend restarts. Cache hits and
-- geofence-suppressed ticks don't count — only actual API calls.

ALTER TABLE "alerts" ADD COLUMN "probe_count" INTEGER NOT NULL DEFAULT 0;
