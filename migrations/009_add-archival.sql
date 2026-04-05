-- Up Migration
-- Function to archive old events (older than 1 year) and clean up associated data
CREATE OR REPLACE FUNCTION archive_old_events(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Delete events older than retention period
  -- ON DELETE CASCADE in liked_events handles cleanup automatically
  DELETE FROM events
  WHERE starts_at < NOW() - (retention_days || ' days')::interval;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Down Migration
DROP FUNCTION IF EXISTS archive_old_events;
