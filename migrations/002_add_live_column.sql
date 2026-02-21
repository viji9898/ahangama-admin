-- Migration: Add live flag to venues
-- Goal: introduce a boolean `live` column, defaulting to true, and backfill existing rows.

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS live BOOLEAN;

-- Backfill (handles older rows / older Postgres behavior)
UPDATE venues
SET live = TRUE
WHERE live IS NULL;

ALTER TABLE venues
  ALTER COLUMN live SET DEFAULT TRUE;

ALTER TABLE venues
  ALTER COLUMN live SET NOT NULL;
