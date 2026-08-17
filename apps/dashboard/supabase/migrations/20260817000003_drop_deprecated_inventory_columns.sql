-- Final step of the variant-unification migration
-- (20260817000001_unify_inventory_variants.sql,
-- 20260817000002_variant_only_rpcs.sql): every write/read path in both
-- apps.dashboard and apps.store has been moved onto inventory_variants
-- exclusively (verified live, both apps rebuild cleanly). These columns
-- have had nothing writing to them since that migration -- leaving them
-- in place, unread and un-updated, would just be a second, quieter
-- version of the exact problem this whole effort exists to close: a
-- column that LOOKS authoritative but silently isn't. Dropped rather than
-- left to rot.
ALTER TABLE inventory
  DROP COLUMN IF EXISTS stock_quantity,
  DROP COLUMN IF EXISTS quantity_reserved,
  DROP COLUMN IF EXISTS sold_quantity,
  DROP COLUMN IF EXISTS base_price,
  DROP COLUMN IF EXISTS cost,
  DROP COLUMN IF EXISTS has_variants;
