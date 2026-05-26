CREATE TABLE IF NOT EXISTS partner_touchpoint_inventory (
  venue_id TEXT NOT NULL,
  touchpoint_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,

  CONSTRAINT partner_touchpoint_inventory_pkey
    PRIMARY KEY (venue_id, touchpoint_type),

  CONSTRAINT partner_touchpoint_inventory_venue_fk
    FOREIGN KEY (venue_id) REFERENCES venues260414 (id)
    ON DELETE CASCADE,

  CONSTRAINT partner_touchpoint_inventory_touchpoint_type_check
    CHECK (touchpoint_type IN ('qr_stand', 'postcard_stand', 'tea_tin', 'tote_bag', 'other')),

  CONSTRAINT partner_touchpoint_inventory_quantity_nonnegative
    CHECK (quantity >= 0)
);

DROP TRIGGER IF EXISTS trg_partner_touchpoint_inventory_set_updated_at ON partner_touchpoint_inventory;

CREATE TRIGGER trg_partner_touchpoint_inventory_set_updated_at
BEFORE UPDATE ON partner_touchpoint_inventory
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_partner_touchpoint_inventory_venue_id
  ON partner_touchpoint_inventory (venue_id);

CREATE INDEX IF NOT EXISTS idx_partner_touchpoint_inventory_updated_at
  ON partner_touchpoint_inventory (updated_at DESC);
