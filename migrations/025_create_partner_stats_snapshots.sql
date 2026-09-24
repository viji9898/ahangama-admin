CREATE TABLE IF NOT EXISTS partner_article_mappings (
  venue_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  article_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT partner_article_mappings_pkey
    PRIMARY KEY (venue_id, content_id)
);

CREATE TABLE IF NOT EXISTS partner_stats_snapshots (
  venue_id TEXT NOT NULL,
  partner_slug TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  period_days INTEGER NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT partner_stats_snapshots_pkey
    PRIMARY KEY (venue_id, snapshot_date, period_days),
  CONSTRAINT partner_stats_snapshots_period_days_check
    CHECK (period_days IN (7, 30, 90, 180, 365)),
  CONSTRAINT partner_stats_snapshots_payload_object_check
    CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS partner_stats_snapshots_lookup_idx
  ON partner_stats_snapshots (partner_slug, period_days, snapshot_date DESC);

INSERT INTO partner_article_mappings (venue_id, content_id, article_url)
VALUES (
  'patels-ahangama',
  'petals-ahangama-a-dream-rooted-in-legacy',
  'https://ahangama.com/petals-ahangama-a-dream-rooted-in-legacy/'
)
ON CONFLICT (venue_id, content_id) DO UPDATE SET
  article_url = EXCLUDED.article_url,
  active = TRUE,
  updated_at = NOW();