CREATE TABLE IF NOT EXISTS partner_contacts (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  reference_key TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'other',
  email TEXT,
  whatsapp TEXT,
  phone TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT partner_contacts_venue_fk
    FOREIGN KEY (venue_id) REFERENCES venues260414 (id)
    ON DELETE CASCADE,

  CONSTRAINT partner_contacts_reference_key_unique
    UNIQUE (reference_key),

  CONSTRAINT partner_contacts_id_not_blank
    CHECK (btrim(id) <> ''),

  CONSTRAINT partner_contacts_reference_key_not_blank
    CHECK (btrim(reference_key) <> ''),

  CONSTRAINT partner_contacts_reference_key_format
    CHECK (reference_key ~ '^[A-Z0-9]+$'),

  CONSTRAINT partner_contacts_contact_name_not_blank
    CHECK (btrim(contact_name) <> ''),

  CONSTRAINT partner_contacts_role_check
    CHECK (role IN ('owner', 'manager', 'other'))
);

DROP TRIGGER IF EXISTS trg_partner_contacts_set_updated_at ON partner_contacts;

CREATE TRIGGER trg_partner_contacts_set_updated_at
BEFORE UPDATE ON partner_contacts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_partner_contacts_venue_id
  ON partner_contacts (venue_id);

CREATE INDEX IF NOT EXISTS idx_partner_contacts_role
  ON partner_contacts (role);

CREATE INDEX IF NOT EXISTS idx_partner_contacts_deleted_at
  ON partner_contacts (deleted_at);

CREATE INDEX IF NOT EXISTS idx_partner_contacts_updated_at
  ON partner_contacts (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_contacts_active
  ON partner_contacts (active)
  WHERE deleted_at IS NULL;
