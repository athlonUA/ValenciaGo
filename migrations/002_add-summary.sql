-- Up Migration
ALTER TABLE events ADD COLUMN summary VARCHAR(200);

-- Down Migration
ALTER TABLE events DROP COLUMN IF EXISTS summary;
