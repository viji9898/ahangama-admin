CREATE TABLE IF NOT EXISTS online_guide_media (
  id TEXT PRIMARY KEY,
  venue_id TEXT REFERENCES venues260414 (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT online_guide_media_description_not_blank
    CHECK (btrim(description) <> ''),
  CONSTRAINT online_guide_media_s3_key_prefix
    CHECK (s3_key LIKE 'ahangama-online-guide/%'),
  CONSTRAINT online_guide_media_content_type
    CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT online_guide_media_size_positive
    CHECK (size_bytes > 0),
  CONSTRAINT online_guide_media_width_positive
    CHECK (width IS NULL OR width > 0),
  CONSTRAINT online_guide_media_height_positive
    CHECK (height IS NULL OR height > 0)
);

CREATE INDEX IF NOT EXISTS online_guide_media_created_at_idx
  ON online_guide_media (created_at DESC);

CREATE INDEX IF NOT EXISTS online_guide_media_venue_id_idx
  ON online_guide_media (venue_id, created_at DESC);