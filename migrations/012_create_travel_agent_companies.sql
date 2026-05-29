CREATE TABLE IF NOT EXISTS travel_agent_companies (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT travel_agent_companies_id_not_blank
    CHECK (btrim(id) <> ''),

  CONSTRAINT travel_agent_companies_company_name_not_blank
    CHECK (btrim(company_name) <> '')
);

DROP TRIGGER IF EXISTS trg_travel_agent_companies_set_updated_at ON travel_agent_companies;

CREATE TRIGGER trg_travel_agent_companies_set_updated_at
BEFORE UPDATE ON travel_agent_companies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_agent_companies_company_name_unique
  ON travel_agent_companies (lower(company_name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_travel_agent_companies_deleted_at
  ON travel_agent_companies (deleted_at);

CREATE INDEX IF NOT EXISTS idx_travel_agent_companies_updated_at
  ON travel_agent_companies (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_travel_agent_companies_active
  ON travel_agent_companies (active)
  WHERE deleted_at IS NULL;