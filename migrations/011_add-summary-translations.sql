-- Up Migration
ALTER TABLE events ADD COLUMN IF NOT EXISTS summary_uk VARCHAR(200);
ALTER TABLE events ADD COLUMN IF NOT EXISTS summary_es VARCHAR(200);

-- Down Migration
-- ALTER TABLE events DROP COLUMN IF EXISTS summary_uk;
-- ALTER TABLE events DROP COLUMN IF EXISTS summary_es;
