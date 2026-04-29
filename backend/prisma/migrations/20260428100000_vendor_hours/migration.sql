-- Optional operating-hours JSON on vendors. Shape:
--   { "mon": { "open": "08:00", "close": "22:00" }, ..., "sun": null }
-- null means closed that day; missing column means hours not yet set.

ALTER TABLE "vendors" ADD COLUMN "hours" JSONB;
