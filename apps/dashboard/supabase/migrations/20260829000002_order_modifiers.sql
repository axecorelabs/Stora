-- Structured modifiers alongside the existing plain-text `notes` string on
-- cart_items/order_items/sale_items. notes stays exactly as-is (unchanged
-- for every existing reader -- CartPageContent.js, order views, receipts);
-- modifiers is purely additive and becomes the canonical structured source
-- going forward, e.g. for a future kitchen/order-line view that needs
-- "no onions" as its own field rather than parsed out of a sentence.
--
-- Shape: { extras: string[], note: string }. No CHECK constraint, matching
-- this schema's existing unconstrained JSONB columns (variant_info,
-- product_snapshot) -- avoids a migration-time backfill requirement.
ALTER TABLE cart_items  ADD COLUMN IF NOT EXISTS modifiers JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS modifiers JSONB;
ALTER TABLE sale_items  ADD COLUMN IF NOT EXISTS modifiers JSONB;
