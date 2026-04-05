-- Up Migration
ALTER TABLE hidden_events RENAME TO liked_events;
ALTER TABLE liked_events RENAME COLUMN hidden_at TO liked_at;
ALTER INDEX idx_hidden_events_user RENAME TO idx_liked_events_user;

-- Down Migration
ALTER INDEX idx_liked_events_user RENAME TO idx_hidden_events_user;
ALTER TABLE liked_events RENAME COLUMN liked_at TO hidden_at;
ALTER TABLE liked_events RENAME TO hidden_events;
