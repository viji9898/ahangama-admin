INSERT INTO partner_article_mappings (venue_id, content_id, article_url)
VALUES (
  'coco-kitchen',
  'coco-kitchen-the-pursuit-of-coastal-fine-dining-in-ahangama',
  'https://ahangama.com/coco-kitchen-the-pursuit-of-coastal-fine-dining-in-ahangama/'
)
ON CONFLICT (venue_id, content_id) DO UPDATE SET
  article_url = EXCLUDED.article_url,
  active = TRUE,
  updated_at = NOW();