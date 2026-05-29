CREATE TABLE IF NOT EXISTS travel_agent_interactions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  outcome_status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT NOT NULL,
  feedback TEXT,
  next_action TEXT,
  next_follow_up_at TIMESTAMPTZ,
  interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT travel_agent_interactions_company_fk
    FOREIGN KEY (company_id) REFERENCES travel_agent_companies (id)
    ON DELETE CASCADE,

  CONSTRAINT travel_agent_interactions_contact_fk
    FOREIGN KEY (contact_id) REFERENCES travel_agent_contacts (id)
    ON DELETE CASCADE,

  CONSTRAINT travel_agent_interactions_id_not_blank
    CHECK (btrim(id) <> ''),

  CONSTRAINT travel_agent_interactions_summary_not_blank
    CHECK (btrim(summary) <> ''),

  CONSTRAINT travel_agent_interactions_type_check
    CHECK (interaction_type IN ('call', 'whatsapp', 'email', 'visit', 'feedback')),

  CONSTRAINT travel_agent_interactions_outcome_check
    CHECK (outcome_status IN ('pending', 'successful', 'no_response', 'not_interested'))
);

CREATE INDEX IF NOT EXISTS idx_travel_agent_interactions_company_id
  ON travel_agent_interactions (company_id);

CREATE INDEX IF NOT EXISTS idx_travel_agent_interactions_contact_id
  ON travel_agent_interactions (contact_id);

CREATE INDEX IF NOT EXISTS idx_travel_agent_interactions_interaction_at
  ON travel_agent_interactions (interaction_at DESC);