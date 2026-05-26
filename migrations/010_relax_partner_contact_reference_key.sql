ALTER TABLE partner_contacts
  DROP CONSTRAINT IF EXISTS partner_contacts_reference_key_unique;

ALTER TABLE partner_contacts
  DROP CONSTRAINT IF EXISTS partner_contacts_reference_key_not_blank;

ALTER TABLE partner_contacts
  DROP CONSTRAINT IF EXISTS partner_contacts_reference_key_format;

ALTER TABLE partner_contacts
  ALTER COLUMN reference_key DROP NOT NULL;