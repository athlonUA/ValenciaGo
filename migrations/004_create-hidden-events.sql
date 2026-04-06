-- Up Migration
CREATE TABLE IF NOT EXISTS hidden_events (
  user_id  BIGINT NOT NULL,
  event_id UUID   NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX idx_hidden_events_user ON hidden_events (user_id);

-- Down Migration (intentionally disabled — migration 005 renamed this table)
-- DROP TABLE IF EXISTS hidden_events CASCADE;
