-- Migration: Add curation/filtering fields to venues
-- Goal: support improved curation and filtering with safe defaults + backfill.

-- 1) Columns (idempotent)
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS editorial_tags TEXT[];

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS is_pass_venue BOOLEAN;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS staff_pick BOOLEAN;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS laptop_friendly BOOLEAN;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS power_backup VARCHAR;

-- 2) Backfill existing rows (handles pre-existing NULLs)
-- is_pass_venue = true if offers exists and offers.length > 0
UPDATE venues
SET
  editorial_tags   = COALESCE(editorial_tags, '{}'::text[]),
  staff_pick       = COALESCE(staff_pick, FALSE),
  priority_score   = COALESCE(priority_score, 0),
  laptop_friendly  = COALESCE(laptop_friendly, FALSE),
  power_backup     = COALESCE(power_backup, 'unknown'),
  is_pass_venue    = COALESCE(
                     is_pass_venue,
                     CASE
                       WHEN offers IS NULL THEN FALSE
                       WHEN jsonb_typeof(offers) = 'array' AND jsonb_array_length(offers) > 0 THEN TRUE
                       ELSE FALSE
                     END
                   )
WHERE
  editorial_tags IS NULL
  OR staff_pick IS NULL
  OR priority_score IS NULL
  OR laptop_friendly IS NULL
  OR power_backup IS NULL
  OR is_pass_venue IS NULL;

-- 3) Defaults + NOT NULL (avoid nulls for new/updated rows)
ALTER TABLE venues
  ALTER COLUMN editorial_tags SET DEFAULT '{}'::text[];
ALTER TABLE venues
  ALTER COLUMN editorial_tags SET NOT NULL;

ALTER TABLE venues
  ALTER COLUMN is_pass_venue SET DEFAULT FALSE;
ALTER TABLE venues
  ALTER COLUMN is_pass_venue SET NOT NULL;

ALTER TABLE venues
  ALTER COLUMN staff_pick SET DEFAULT FALSE;
ALTER TABLE venues
  ALTER COLUMN staff_pick SET NOT NULL;

ALTER TABLE venues
  ALTER COLUMN priority_score SET DEFAULT 0;
ALTER TABLE venues
  ALTER COLUMN priority_score SET NOT NULL;

ALTER TABLE venues
  ALTER COLUMN laptop_friendly SET DEFAULT FALSE;
ALTER TABLE venues
  ALTER COLUMN laptop_friendly SET NOT NULL;

ALTER TABLE venues
  ALTER COLUMN power_backup SET DEFAULT 'unknown';
ALTER TABLE venues
  ALTER COLUMN power_backup SET NOT NULL;

-- 4) Constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'venues_priority_score_nonneg'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_priority_score_nonneg
      CHECK (priority_score >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'venues_power_backup_allowed'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_power_backup_allowed
      CHECK (power_backup IN ('generator', 'inverter', 'none', 'unknown'));
  END IF;
END $$;
