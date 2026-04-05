-- Up Migration
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_events_title_trgm ON events USING GIN (title gin_trgm_ops);
CREATE INDEX idx_events_summary_trgm ON events USING GIN (summary gin_trgm_ops);

-- Down Migration
DROP INDEX IF EXISTS idx_events_summary_trgm;
DROP INDEX IF EXISTS idx_events_title_trgm;
DROP EXTENSION IF EXISTS pg_trgm;
