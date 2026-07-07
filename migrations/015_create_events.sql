CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  venue_id TEXT,
  venue_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME NOT NULL,
  end_time TIME,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_type TEXT,
  day_of_week TEXT,
  price_type TEXT NOT NULL DEFAULT 'free',
  price TEXT,
  booking_url TEXT,
  whatsapp_number TEXT,
  image_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  editorial_pick BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT,
  last_verified_at TIMESTAMPTZ,
  intelligence_score INTEGER NOT NULL DEFAULT 0,
  editor_priority TEXT NOT NULL DEFAULT 'medium',
  editor_notes TEXT,
  audience TEXT NOT NULL DEFAULT 'both',
  season TEXT NOT NULL DEFAULT 'shoulder',
  featured_this_week BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT events_id_not_blank
    CHECK (btrim(id) <> ''),

  CONSTRAINT events_title_not_blank
    CHECK (btrim(title) <> ''),

  CONSTRAINT events_venue_name_not_blank
    CHECK (btrim(venue_name) <> ''),

  CONSTRAINT events_date_order_check
    CHECK (end_date IS NULL OR start_date <= end_date),

  CONSTRAINT events_time_order_check
    CHECK (end_time IS NULL OR start_time < end_time),

  CONSTRAINT events_category_check
    CHECK (category IN (
      'wellness', 'music', 'surf_ocean', 'food_drink', 'community',
      'workshops', 'fitness', 'nightlife', 'arts_culture', 'markets'
    )),

  CONSTRAINT events_recurring_type_check
    CHECK (recurring_type IS NULL OR recurring_type IN ('daily', 'weekly', 'monthly')),

  CONSTRAINT events_price_type_check
    CHECK (price_type IN ('free', 'paid')),

  CONSTRAINT events_status_check
    CHECK (status IN ('draft', 'published')),

  CONSTRAINT events_intelligence_score_check
    CHECK (intelligence_score >= 0 AND intelligence_score <= 100),

  CONSTRAINT events_editor_priority_check
    CHECK (editor_priority IN ('low', 'medium', 'high')),

  CONSTRAINT events_audience_check
    CHECK (audience IN ('tourist', 'resident', 'both')),

  CONSTRAINT events_season_check
    CHECK (season IN ('high', 'shoulder', 'low'))
);

CREATE INDEX IF NOT EXISTS idx_events_start_date
  ON events (start_date, start_time);

CREATE INDEX IF NOT EXISTS idx_events_category
  ON events (category, subcategory);

CREATE INDEX IF NOT EXISTS idx_events_status
  ON events (status);

CREATE INDEX IF NOT EXISTS idx_events_featured_this_week
  ON events (featured_this_week);

CREATE INDEX IF NOT EXISTS idx_events_tags
  ON events USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_events_deleted_at
  ON events (deleted_at);