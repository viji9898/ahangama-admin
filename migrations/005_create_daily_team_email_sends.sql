CREATE TABLE IF NOT EXISTS daily_team_email_sends (
  report_name TEXT NOT NULL,
  report_date DATE NOT NULL,
  sent_to TEXT[] NOT NULL DEFAULT '{}'::text[],
  subject TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT daily_team_email_sends_pkey
    PRIMARY KEY (report_name, report_date),

  CONSTRAINT daily_team_email_sends_payload_object
    CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_daily_team_email_sends_sent_at
  ON daily_team_email_sends (sent_at DESC);