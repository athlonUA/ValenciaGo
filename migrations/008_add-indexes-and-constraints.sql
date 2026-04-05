-- Up Migration
-- Composite index on liked_events for efficient JOIN queries
CREATE INDEX IF NOT EXISTS idx_liked_events_user_event
  ON liked_events (user_id, event_id);

-- Index on created_at for future archival/cleanup queries
CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON events (created_at);

-- Add unique constraint for cross-source deduplication
-- This replaces the application-level existsByContentHash check
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_content_hash
  ON events (content_hash);

-- Check constraint: ends_at must be after starts_at (when set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_end_after_start'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_end_after_start
      CHECK (ends_at IS NULL OR ends_at > starts_at);
  END IF;
END
$$;

-- Down Migration
DROP INDEX IF EXISTS idx_liked_events_user_event;
DROP INDEX IF EXISTS idx_events_created_at;
DROP INDEX IF EXISTS uq_events_content_hash;
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_events_end_after_start;
