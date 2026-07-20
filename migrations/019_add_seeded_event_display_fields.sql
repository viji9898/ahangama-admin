ALTER TABLE events
  ADD COLUMN IF NOT EXISTS day_key TEXT,
  ADD COLUMN IF NOT EXISTS weekday TEXT,
  ADD COLUMN IF NOT EXISTS day_number TEXT,
  ADD COLUMN IF NOT EXISTS month TEXT,
  ADD COLUMN IF NOT EXISTS display_time TEXT,
  ADD COLUMN IF NOT EXISTS mobile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS offer_image_url TEXT,
  ADD COLUMN IF NOT EXISTS offer_text TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS venue_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pass_benefit JSONB,
  ADD COLUMN IF NOT EXISTS event_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS directions_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS raw_event JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_events_day_key_order
  ON events (day_key, event_order, start_time);

CREATE INDEX IF NOT EXISTS idx_events_source_key
  ON events (source_key);
