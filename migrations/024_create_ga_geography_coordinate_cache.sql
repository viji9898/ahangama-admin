CREATE TABLE IF NOT EXISTS ga_geography_coordinate_cache (
  location_key TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT NOT NULL CHECK (status IN ('resolved', 'not_found')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ga_geography_coordinate_cache_country_idx
  ON ga_geography_coordinate_cache (country);