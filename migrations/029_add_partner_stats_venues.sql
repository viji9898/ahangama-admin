INSERT INTO partner_stats_config (venue_id, sort_order)
VALUES
  ('villa-alba', 40),
  ('crossfit-ceylon-palm-gym', 50),
  ('ko-lake', 60),
  ('kaffi-ahangama', 70),
  ('citra-ahangama', 80),
  ('aliikai-ahangama', 90),
  ('sisters-kabalana', 100),
  ('calma-samaya', 110),
  ('casa-samaya', 120),
  ('caf-samaya', 130),
  ('nirbana-retreat', 140),
  ('coco-kitchen', 150)
ON CONFLICT (venue_id) DO UPDATE SET
  enabled = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO partner_article_mappings (venue_id, content_id, article_url)
VALUES
  (
    'crossfit-ceylon-palm-gym',
    'crossfit-ceylon-palm-training-in-the-jungle',
    'https://ahangama.com/crossfit-ceylon-palm-training-in-the-jungle/'
  ),
  (
    'villa-alba',
    'villa-alba-a-boutique-hotel-with-a-commitment-to-those-who-built-it',
    'https://ahangama.com/villa-alba-a-boutique-hotel-with-a-commitment-to-those-who-built-it/'
  )
ON CONFLICT (venue_id, content_id) DO UPDATE SET
  article_url = EXCLUDED.article_url,
  active = TRUE,
  updated_at = NOW();
