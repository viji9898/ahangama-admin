INSERT INTO partner_article_mappings (venue_id, content_id, article_url)
VALUES (
  'villa-mugatiya',
  'the-mugatiya-a-heritage-villa-made-for-slower-days-in-ahangama',
  'https://ahangama.com/the-mugatiya-a-heritage-villa-made-for-slower-days-in-ahangama/'
)
ON CONFLICT (venue_id, content_id) DO UPDATE SET
  article_url = EXCLUDED.article_url,
  active = TRUE,
  updated_at = NOW();