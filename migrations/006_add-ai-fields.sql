-- Up Migration
ALTER TABLE events ADD COLUMN ai_price VARCHAR(100);
ALTER TABLE events ADD COLUMN ai_time VARCHAR(50);

-- Down Migration
ALTER TABLE events DROP COLUMN IF EXISTS ai_time;
ALTER TABLE events DROP COLUMN IF EXISTS ai_price;
