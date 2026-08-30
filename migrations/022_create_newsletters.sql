CREATE TABLE IF NOT EXISTS newsletters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_sources TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,

  CONSTRAINT newsletters_status_check
    CHECK (status IN ('draft', 'sent', 'archived')),
  CONSTRAINT newsletters_blocks_array
    CHECK (jsonb_typeof(blocks) = 'array')
);

CREATE TABLE IF NOT EXISTS newsletter_imported_recipients (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  list_name TEXT NOT NULL DEFAULT 'Imported',
  subscribed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT newsletter_imported_recipients_email_key UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS newsletter_sends (
  id TEXT PRIMARY KEY,
  newsletter_id TEXT NOT NULL REFERENCES newsletters(id),
  subject TEXT NOT NULL,
  audience_sources TEXT[] NOT NULL DEFAULT '{}'::text[],
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_by TEXT,
  sendgrid_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'accepted',
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT newsletter_sends_status_check
    CHECK (status IN ('accepted', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_newsletters_updated_at
  ON newsletters (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_newsletter
  ON newsletter_sends (newsletter_id, sent_at DESC);
