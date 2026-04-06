-- Up Migration
CREATE INDEX IF NOT EXISTS idx_liked_events_event_id ON liked_events (event_id);

-- Down Migration
-- DROP INDEX IF EXISTS idx_liked_events_event_id;
