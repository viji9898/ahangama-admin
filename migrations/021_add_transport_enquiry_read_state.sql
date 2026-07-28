DO $$
BEGIN
  IF to_regclass('transport_enquiries') IS NOT NULL THEN
    ALTER TABLE transport_enquiries
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

    CREATE INDEX IF NOT EXISTS idx_transport_enquiries_unread_created_at
      ON transport_enquiries (created_at DESC)
      WHERE is_read = false;
  END IF;
END $$;