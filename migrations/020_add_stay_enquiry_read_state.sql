DO $$
BEGIN
  IF to_regclass('stay_enquiries') IS NOT NULL THEN
    ALTER TABLE stay_enquiries
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

    CREATE INDEX IF NOT EXISTS idx_stay_enquiries_unread_created_at
      ON stay_enquiries (created_at DESC)
      WHERE is_read = false;
  END IF;
END $$;