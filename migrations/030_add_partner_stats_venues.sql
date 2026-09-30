INSERT INTO partner_stats_config (venue_id, sort_order)
VALUES
  ('azure-swim', 160),
  ('the-well', 170),
  ('ahangama-beach-house', 180),
  ('soul-surf', 190)
ON CONFLICT (venue_id) DO UPDATE SET
  enabled = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();