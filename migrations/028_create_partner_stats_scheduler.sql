CREATE TABLE IF NOT EXISTS partner_stats_config (
  venue_id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_stats_collection_jobs (
  venue_id TEXT NOT NULL REFERENCES partner_stats_config (venue_id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period_days INTEGER NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  lease_expires_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT partner_stats_collection_jobs_pkey
    PRIMARY KEY (venue_id, snapshot_date, period_days),
  CONSTRAINT partner_stats_collection_jobs_period_days_check
    CHECK (period_days IN (7, 30, 90, 180, 365)),
  CONSTRAINT partner_stats_collection_jobs_status_check
    CHECK (status IN ('running', 'failed', 'completed'))
);

CREATE INDEX IF NOT EXISTS partner_stats_collection_jobs_retry_idx
  ON partner_stats_collection_jobs (snapshot_date, status, next_attempt_at);

INSERT INTO partner_stats_config (venue_id, sort_order)
VALUES
  ('patels-ahangama', 10),
  ('villa-mugatiya', 20),
  ('ribs', 30)
ON CONFLICT (venue_id) DO UPDATE SET
  enabled = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();