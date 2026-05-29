CREATE TABLE IF NOT EXISTS travel_agent_contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  phone TEXT,
  notes TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT travel_agent_contacts_company_fk
    FOREIGN KEY (company_id) REFERENCES travel_agent_companies (id)
    ON DELETE CASCADE,

  CONSTRAINT travel_agent_contacts_id_not_blank
    CHECK (btrim(id) <> ''),

  CONSTRAINT travel_agent_contacts_full_name_not_blank
    CHECK (btrim(full_name) <> '')
);

DROP TRIGGER IF EXISTS trg_travel_agent_contacts_set_updated_at ON travel_agent_contacts;

CREATE TRIGGER trg_travel_agent_contacts_set_updated_at
BEFORE UPDATE ON travel_agent_contacts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_travel_agent_contacts_company_id
  ON travel_agent_contacts (company_id);

CREATE INDEX IF NOT EXISTS idx_travel_agent_contacts_deleted_at
  ON travel_agent_contacts (deleted_at);

CREATE INDEX IF NOT EXISTS idx_travel_agent_contacts_updated_at
  ON travel_agent_contacts (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_travel_agent_contacts_active
  ON travel_agent_contacts (active)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_travel_agent_contacts_email
  ON travel_agent_contacts (lower(email))
  WHERE deleted_at IS NULL;