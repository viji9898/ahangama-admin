ALTER TABLE partner_interactions
  ADD COLUMN IF NOT EXISTS outcome_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE partner_interactions
  DROP CONSTRAINT IF EXISTS partner_interactions_outcome_status_check;

ALTER TABLE partner_interactions
  ADD CONSTRAINT partner_interactions_outcome_status_check
  CHECK (outcome_status IN ('pending', 'successful', 'no_response', 'not_interested'));

CREATE INDEX IF NOT EXISTS idx_partner_interactions_outcome_status
  ON partner_interactions (outcome_status);
