-- Vendor opt-in flag for the AI Try-On feature -- exact sibling of
-- web_visibility (20260717000000_initial_schema.sql). Not automatic by
-- category: a vendor must knowingly enable this on a specific product,
-- since it means that product's photo gets used to composite onto a
-- stranger's uploaded photo via a third-party AI model.
ALTER TABLE inventory ADD COLUMN ai_tryon_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_inventory_ai_tryon_enabled ON inventory(ai_tryon_enabled) WHERE ai_tryon_enabled = true;
