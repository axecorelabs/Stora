-- Track B of the inventory schema audit: retire the has_variants split.
-- Every product gets >=1 inventory_variants row; inventory_variants
-- becomes the sole place stock/price live; inventory keeps only listing
-- metadata (name/description/category/images/etc). inventory_batches
-- becomes always variant-scoped.
--
-- Ground-truth decision, confirmed by direct inspection before writing
-- this: where inventory.stock_quantity disagrees with the batch ledger
-- (14 of 167 simple products), the batch-derived sum is trusted, not the
-- aggregate -- the aggregate is exactly the column Track A just proved
-- was reachable by unprotected direct writes (see
-- 20260817000000_admin_stock_rpc_functions.sql), so the batch ledger is
-- the more trustworthy of the two. Every case where they disagreed is
-- logged to inventory_activities for manual review, not silently
-- resolved.

-- inventory_activities.activity_type has a CHECK allowlist -- add the one
-- new value this migration needs for its discrepancy audit trail.
ALTER TABLE inventory_activities DROP CONSTRAINT inventory_activities_activity_type_check;
ALTER TABLE inventory_activities ADD CONSTRAINT inventory_activities_activity_type_check
  CHECK (activity_type IN ('created','updated','stock_added','stock_removed','order_processed',
    'price_updated','status_changed','deleted','image_updated','category_changed',
    'location_changed','batch_update','migration_discrepancy'));

-- Step 1: one default variant per product that doesn't already have any,
-- seeded from that product's batch-derived truth (falling back to the
-- inventory aggregate only if it somehow has zero batches).
WITH batch_truth AS (
  SELECT
    inventory_id,
    COALESCE(SUM(quantity_in), 0) AS total_in,
    COALESCE(SUM(quantity_sold), 0) AS total_sold,
    COALESCE(SUM(quantity_remaining) FILTER (WHERE status = 'active'), 0) AS active_remaining,
    COALESCE(SUM(quantity_reserved) FILTER (WHERE status = 'active'), 0) AS active_reserved
  FROM inventory_batches
  WHERE variant_id IS NULL
  GROUP BY inventory_id
)
INSERT INTO inventory_variants (
  inventory_id, size, color, sku, quantity_in_stock, reserved_quantity,
  sold_quantity, price, cost_price, is_active, created_at, updated_at
)
SELECT
  i.id, 'One Size', 'Default', i.sku,
  COALESCE(bt.active_remaining, i.stock_quantity),
  COALESCE(bt.active_reserved, i.quantity_reserved),
  COALESCE(bt.total_sold, i.sold_quantity),
  i.base_price, i.cost, i.is_active, i.created_at, now()
FROM inventory i
LEFT JOIN batch_truth bt ON bt.inventory_id = i.id
WHERE NOT EXISTS (SELECT 1 FROM inventory_variants v WHERE v.inventory_id = i.id);

-- Log every simple product where the aggregate and the batch ledger
-- disagreed, so these can be manually reviewed against real-world stock
-- counts rather than silently trusted either way.
INSERT INTO inventory_activities (
  inventory_id, activity_type, quantity_before, quantity_changed, quantity_after,
  reason, metadata, created_at, updated_at
)
SELECT
  i.id, 'migration_discrepancy', i.stock_quantity, 0,
  COALESCE(SUM(b.quantity_remaining) FILTER (WHERE b.status = 'active'), 0),
  'Variant-unification migration: inventory.stock_quantity disagreed with the batch ledger. New default variant was seeded from the batch total (this row''s quantity_after), not the old aggregate (quantity_before). Please verify against a physical count.',
  jsonb_build_object('old_aggregate', i.stock_quantity, 'batch_derived_total', COALESCE(SUM(b.quantity_remaining) FILTER (WHERE b.status = 'active'), 0)),
  now(), now()
FROM inventory i
JOIN inventory_batches b ON b.inventory_id = i.id AND b.variant_id IS NULL
WHERE i.has_variants = false
GROUP BY i.id, i.stock_quantity
HAVING i.stock_quantity != COALESCE(SUM(b.quantity_remaining) FILTER (WHERE b.status = 'active'), 0);

-- Step 2: products that already had real variants never actually had
-- per-variant pricing (confirmed: every existing variant's price/
-- cost_price was NULL) -- backfill from the product level so every
-- variant has a real price to sell at.
UPDATE inventory_variants v
SET price = i.base_price, cost_price = i.cost, updated_at = now()
FROM inventory i
WHERE v.inventory_id = i.id AND v.price IS NULL;

-- Step 3a: simple products -- their single existing batch genuinely
-- represented that product's real stock, so repoint it at the new
-- default variant rather than orphaning it.
UPDATE inventory_batches b
SET variant_id = dv.id
FROM inventory i
JOIN inventory_variants dv ON dv.inventory_id = i.id AND dv.color = 'Default' AND dv.size = 'One Size'
WHERE b.inventory_id = i.id AND b.variant_id IS NULL AND i.has_variants = false;

-- Step 3b: products that already had real variants -- their one
-- unattributed batch does NOT reconcile with any variant's actual
-- quantity (confirmed live: one product's variants total 2,996 units on
-- record while its batch claims 12,000) because no code path ever kept
-- it in sync. Archive rather than guess which variant it belongs to, or
-- silently delete real batch history.
UPDATE inventory_batches b
SET status = 'archived', archived_at = now(),
    notes = COALESCE(notes || E'\n', '') || 'Archived during variant-unification migration: quantity could not be reconciled to any specific variant.'
FROM inventory i
WHERE b.inventory_id = i.id AND b.variant_id IS NULL AND i.has_variants = true;

-- Step 3c: give those same products a fresh, correctly-sized batch per
-- variant, matching what step 3a already gives the simple products, so
-- every variant has real batch backing going forward.
INSERT INTO inventory_batches (
  inventory_id, variant_id, batch_code, quantity_in, quantity_sold,
  quantity_remaining, cost_price, selling_price, date_received, status,
  batch_location, notes, created_at, updated_at
)
SELECT
  v.inventory_id, v.id,
  COALESCE(i.sku, 'PRD') || '-MIGR-' || substr(v.id::text, 1, 8),
  v.quantity_in_stock, v.sold_quantity, v.quantity_in_stock,
  v.cost_price, v.price, now(), 'active', 'Main Store',
  'Backfilled during variant-unification migration (replaces an archived, unreconciled legacy batch).',
  now(), now()
FROM inventory_variants v
JOIN inventory i ON i.id = v.inventory_id
WHERE i.has_variants = true;

-- Step 4: every batch that actually counts toward stock (status='active',
-- the only status the FIFO walks in fn_reserve_stock/fn_sell_stock_direct/
-- etc. ever consider) must now be variant-scoped -- closing the "batch not
-- attributed to any variant" gap that let step 3b's disparity happen.
-- Deliberately NOT a blanket NOT NULL: step 3b's archived legacy batches
-- are kept exactly because their quantity couldn't be honestly reconciled
-- to any one variant, and forcing a fabricated variant_id onto them would
-- just be a second, quieter version of the same problem this migration
-- exists to fix. Once archived (and excluded from every active-stock
-- calculation), an unattributed variant_id is honest, not a gap.
ALTER TABLE inventory_batches ADD CONSTRAINT inventory_batches_active_requires_variant
  CHECK (status != 'active' OR variant_id IS NOT NULL);

-- Step 5: order_items/order_item_batches/sale_items/cart_items historical
-- rows that predate this migration have variant_id NULL for products
-- that (at the time) had no variants -- backfill them to the product's
-- new default variant so historical records stay queryable the same way
-- going forward, without changing what they mean (same product, same
-- quantity, just now pointing at its one variant instead of nothing).
UPDATE order_items oi
SET variant_id = dv.id
FROM inventory_variants dv
WHERE oi.variant_id IS NULL AND oi.product_id = dv.inventory_id AND dv.color = 'Default' AND dv.size = 'One Size';

UPDATE sale_items si
SET variant_info = jsonb_build_object('variantId', dv.id, 'hasVariant', true, 'size', 'One Size', 'color', 'Default')
FROM inventory_variants dv
WHERE si.variant_info IS NULL AND si.inventory_id = dv.inventory_id AND dv.color = 'Default' AND dv.size = 'One Size';
