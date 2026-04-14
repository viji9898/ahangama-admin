-- Migration: Create venues260414 table for admin/public venue management

CREATE TABLE IF NOT EXISTS venues260414 (
  id TEXT PRIMARY KEY,
  destination_slug TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',

  stars NUMERIC,
  reviews INTEGER,
  excerpt TEXT,
  description TEXT,
  best_for TEXT[] NOT NULL DEFAULT '{}'::text[],
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  editorial_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  card_perk TEXT,
  offer JSONB NOT NULL DEFAULT '[]'::jsonb,
  how_to_claim TEXT,
  restrictions TEXT,
  discount NUMERIC,
  price TEXT,
  hours TEXT,
  area TEXT,

  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  map_url TEXT,
  google_place_id TEXT,

  whatsapp TEXT,
  email TEXT,
  instagram TEXT,

  logo TEXT,
  image TEXT,
  og_image TEXT,

  live BOOLEAN NOT NULL DEFAULT FALSE,
  is_pass_venue BOOLEAN NOT NULL DEFAULT FALSE,
  staff_pick BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  priority_score NUMERIC NOT NULL DEFAULT 0,
  pass_priority NUMERIC NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  last_verified_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  source TEXT,
  notes_internal TEXT,

  CONSTRAINT venues260414_destination_slug_slug_key
    UNIQUE (destination_slug, slug),

  CONSTRAINT venues260414_status_check
    CHECK (status IN ('draft', 'active', 'inactive', 'archived', 'coming_soon')),

  CONSTRAINT venues260414_id_not_blank
    CHECK (btrim(id) <> ''),

  CONSTRAINT venues260414_destination_slug_not_blank
    CHECK (btrim(destination_slug) <> ''),

  CONSTRAINT venues260414_category_not_blank
    CHECK (btrim(category) <> ''),

  CONSTRAINT venues260414_name_not_blank
    CHECK (btrim(name) <> ''),

  CONSTRAINT venues260414_slug_not_blank
    CHECK (btrim(slug) <> ''),

  CONSTRAINT venues260414_stars_nonnegative
    CHECK (stars IS NULL OR stars >= 0),

  CONSTRAINT venues260414_reviews_nonnegative
    CHECK (reviews IS NULL OR reviews >= 0),

  CONSTRAINT venues260414_discount_nonnegative
    CHECK (discount IS NULL OR discount >= 0),

  CONSTRAINT venues260414_priority_score_nonnegative
    CHECK (priority_score >= 0),

  CONSTRAINT venues260414_pass_priority_nonnegative
    CHECK (pass_priority >= 0),

  CONSTRAINT venues260414_lat_range_check
    CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),

  CONSTRAINT venues260414_lng_range_check
    CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),

  CONSTRAINT venues260414_offer_is_array
    CHECK (jsonb_typeof(offer) = 'array')
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venues260414_set_updated_at ON venues260414;

CREATE TRIGGER trg_venues260414_set_updated_at
BEFORE UPDATE ON venues260414
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_venues260414_destination_slug
  ON venues260414 (destination_slug);

CREATE INDEX IF NOT EXISTS idx_venues260414_category
  ON venues260414 (category);

CREATE INDEX IF NOT EXISTS idx_venues260414_status
  ON venues260414 (status);

CREATE INDEX IF NOT EXISTS idx_venues260414_live
  ON venues260414 (live);

CREATE INDEX IF NOT EXISTS idx_venues260414_is_pass_venue
  ON venues260414 (is_pass_venue);

CREATE INDEX IF NOT EXISTS idx_venues260414_staff_pick
  ON venues260414 (staff_pick);

CREATE INDEX IF NOT EXISTS idx_venues260414_priority_score
  ON venues260414 (priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_venues260414_deleted_at
  ON venues260414 (deleted_at);

CREATE INDEX IF NOT EXISTS idx_venues260414_slug
  ON venues260414 (slug);

CREATE INDEX IF NOT EXISTS idx_venues260414_destination_status_live
  ON venues260414 (destination_slug, status, live)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_venues260414_featured_priority
  ON venues260414 (is_featured, priority_score DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_venues260414_best_for_gin
  ON venues260414 USING GIN (best_for);

CREATE INDEX IF NOT EXISTS idx_venues260414_tags_gin
  ON venues260414 USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_venues260414_editorial_tags_gin
  ON venues260414 USING GIN (editorial_tags);

CREATE INDEX IF NOT EXISTS idx_venues260414_offer_gin
  ON venues260414 USING GIN (offer);