-- Up Migration
-- Events table: core storage for all discovered events
CREATE TABLE IF NOT EXISTS events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source tracking
  source            VARCHAR(50)   NOT NULL,
  source_id         VARCHAR(500)  NOT NULL,
  source_url        VARCHAR(2000) NOT NULL,

  -- Content
  title             VARCHAR(500)  NOT NULL,
  title_normalized  VARCHAR(500)  NOT NULL,
  description       TEXT,

  -- Classification
  category          VARCHAR(100),
  tags              TEXT[]        DEFAULT '{}',

  -- Location
  city              VARCHAR(100)  NOT NULL DEFAULT 'Valencia',
  venue             VARCHAR(500),
  address           VARCHAR(500),
  latitude          DECIMAL(10, 7),
  longitude         DECIMAL(10, 7),

  -- Time (always stored in UTC, displayed in Europe/Madrid)
  starts_at         TIMESTAMPTZ   NOT NULL,
  ends_at           TIMESTAMPTZ,

  -- Price
  price_info        VARCHAR(255),
  is_free           BOOLEAN       NOT NULL DEFAULT false,

  -- Metadata
  language          VARCHAR(10)   DEFAULT 'es',
  image_url         VARCHAR(2000),
  raw_payload       JSONB,
  content_hash      VARCHAR(64)   NOT NULL,

  -- Timestamps
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ingested_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Prevent duplicate ingestion from same source
CREATE UNIQUE INDEX uq_source_event ON events (source, source_id);

-- Query indexes
CREATE INDEX idx_events_starts_at ON events (starts_at);
CREATE INDEX idx_events_category ON events (category);
CREATE INDEX idx_events_content_hash ON events (content_hash);
CREATE INDEX idx_events_is_free ON events (is_free) WHERE is_free = true;

-- Composite index for common queries: events by start date + category
CREATE INDEX idx_events_starts_category ON events (starts_at, category);

-- Full-text search on title + description (Spanish stemmer)
CREATE INDEX idx_events_fts ON events
  USING GIN (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Down Migration
DROP TABLE IF EXISTS events CASCADE;
