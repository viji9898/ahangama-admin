CREATE TABLE IF NOT EXISTS admin_activity (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  venue_id TEXT,
  contact_id TEXT,
  changed_fields TEXT[],
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at
  ON admin_activity (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_entity
  ON admin_activity (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_venue_id
  ON admin_activity (venue_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_contact_id
  ON admin_activity (contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_actor_email
  ON admin_activity (actor_email, created_at DESC);