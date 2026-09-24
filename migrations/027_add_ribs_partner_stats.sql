INSERT INTO partner_article_mappings (venue_id, content_id, article_url)
VALUES (
  'ribs',
  'the-accidental-story-of-ribs',
  'https://ahangama.com/the-accidental-story-of-ribs/'
)
ON CONFLICT (venue_id, content_id) DO UPDATE SET
  article_url = EXCLUDED.article_url,
  active = TRUE,
  updated_at = NOW();
