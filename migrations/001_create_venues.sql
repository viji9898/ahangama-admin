-- Migration: Create venues table if not exists
CREATE TABLE IF NOT EXISTS venues (
    id TEXT PRIMARY KEY,
    destination_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    categories TEXT[] NOT NULL DEFAULT '{}',
    emoji TEXT[] NOT NULL DEFAULT '{}',
    stars NUMERIC,
    reviews INT,
    discount NUMERIC,
    excerpt TEXT,
    description TEXT,
    best_for TEXT[] NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    card_perk TEXT,
    offers JSONB NOT NULL DEFAULT '[]'::jsonb,
    how_to_claim TEXT,
    restrictions TEXT,
    area TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    logo TEXT,
    image TEXT,
    og_image TEXT,
    map_url TEXT,
    instagram_url TEXT,
    whatsapp TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS venues_slug_unique
ON venues (destination_slug, slug);

-- Auto-update updated_at on row updates
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS venues_set_updated_at ON venues;
CREATE TRIGGER venues_set_updated_at
BEFORE UPDATE ON venues
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
