CREATE TABLE IF NOT EXISTS partner_interactions (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  contact_id TEXT,
  interaction_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  feedback TEXT,
  next_action TEXT,
  next_follow_up_at TIMESTAMPTZ,
  interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,

  CONSTRAINT partner_interactions_venue_fk
    FOREIGN KEY (venue_id) REFERENCES venues260414 (id)
    ON DELETE CASCADE,

  CONSTRAINT partner_interactions_contact_fk
    FOREIGN KEY (contact_id) REFERENCES partner_contacts (id)
    ON DELETE SET NULL,

  CONSTRAINT partner_interactions_id_not_blank
    CHECK (btrim(id) <> ''),

  CONSTRAINT partner_interactions_type_check
    CHECK (interaction_type IN ('call', 'whatsapp', 'email', 'visit', 'feedback')),

  CONSTRAINT partner_interactions_summary_not_blank
    CHECK (btrim(summary) <> '')
);

CREATE INDEX IF NOT EXISTS idx_partner_interactions_venue_id_interaction_at
  ON partner_interactions (venue_id, interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_interactions_contact_id
  ON partner_interactions (contact_id);

CREATE INDEX IF NOT EXISTS idx_partner_interactions_type
  ON partner_interactions (interaction_type);
