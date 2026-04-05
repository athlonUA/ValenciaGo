-- Up Migration
ALTER TABLE events ADD COLUMN emoji VARCHAR(10);

-- Down Migration
ALTER TABLE events DROP COLUMN IF EXISTS emoji;
