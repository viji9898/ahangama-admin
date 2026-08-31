-- Track when a venue's contact fields were last changed.

ALTER TABLE venues260414
  ADD COLUMN IF NOT EXISTS contact_updated_at TIMESTAMPTZ;

UPDATE venues260414
SET contact_updated_at = updated_at
WHERE contact_updated_at IS NULL
  AND (
    NULLIF(BTRIM(COALESCE(email, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(whatsapp, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(instagram, '')), '') IS NOT NULL
  );