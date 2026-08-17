-- Fixes the real scaling bottleneck in search_products(): its trending
-- sort aggregated the *entire* inventory_variants table (SUM ... GROUP BY
-- inventory_id, unfiltered by search/category) on every single call, since
-- inventory.sold_quantity itself has been stale/unmaintained since
-- 20260817000001_unify_inventory_variants.sql moved real sold-quantity
-- tracking onto inventory_variants. Multiple RPCs write
-- inventory_variants.sold_quantity (fn_fulfill_stock_reservation,
-- fn_sell_stock_direct, and predecessors in
-- 20260814000001_stock_reservation_functions.sql) -- a trigger keeps
-- inventory.sold_quantity in sync with all of them (present and future)
-- in one place, rather than patching each RPC individually.

-- inventory.sold_quantity was dropped outright in
-- 20260817000003_drop_deprecated_inventory_columns.sql as a stale,
-- unmaintained leftover from the pre-variant-unification schema. Re-added
-- here as a genuinely different thing: a trigger-maintained rollup that
-- search_products() reads for its trending sort, not a column any write
-- path sets directly -- inventory_variants.sold_quantity remains the only
-- source of truth; this is a cache of its sum, kept in sync below.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sold_quantity INTEGER NOT NULL DEFAULT 0;

-- One-time backfill from the real source of truth (inventory_variants).
UPDATE inventory i
SET sold_quantity = COALESCE((
  SELECT SUM(v.sold_quantity)
  FROM inventory_variants v
  WHERE v.inventory_id = i.id AND v.is_active = true
), 0);

CREATE OR REPLACE FUNCTION fn_sync_inventory_sold_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory_id UUID := COALESCE(NEW.inventory_id, OLD.inventory_id);
BEGIN
  UPDATE inventory
  SET sold_quantity = COALESCE((
    SELECT SUM(sold_quantity)
    FROM inventory_variants
    WHERE inventory_id = v_inventory_id AND is_active = true
  ), 0)
  WHERE id = v_inventory_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sold_qty_update ON inventory_variants;
DROP TRIGGER IF EXISTS trg_sync_sold_qty_insert ON inventory_variants;
DROP TRIGGER IF EXISTS trg_sync_sold_qty_delete ON inventory_variants;

CREATE TRIGGER trg_sync_sold_qty_update
  AFTER UPDATE OF sold_quantity ON inventory_variants
  FOR EACH ROW
  WHEN (OLD.sold_quantity IS DISTINCT FROM NEW.sold_quantity)
  EXECUTE FUNCTION fn_sync_inventory_sold_quantity();

CREATE TRIGGER trg_sync_sold_qty_insert
  AFTER INSERT ON inventory_variants
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_inventory_sold_quantity();

CREATE TRIGGER trg_sync_sold_qty_delete
  AFTER DELETE ON inventory_variants
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_inventory_sold_quantity();

-- Matches idx_inventory_discoverable_new's shape (same base filter), just
-- ordered by the column trending sort now reads directly.
CREATE INDEX IF NOT EXISTS idx_inventory_discoverable_trending
  ON inventory (sold_quantity DESC)
  WHERE is_active = true AND web_visibility = true AND is_deleted = false;

-- search_products(): trending is now a plain indexed column read instead
-- of a LEFT JOIN + GROUP BY over the whole inventory_variants table on
-- every call.
CREATE OR REPLACE FUNCTION search_products(
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'trending',
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (product inventory, total_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT i, count(*) OVER()
  FROM inventory i
  JOIN stores st ON st.id = i.store_id
    AND st.is_active = true
    AND COALESCE((st.website->>'isEnabled')::boolean, false) = true
  WHERE i.is_active = true
    AND i.web_visibility = true
    AND i.is_deleted = false
    AND (p_category IS NULL OR p_category = '' OR i.category = p_category)
    AND (p_search IS NULL OR p_search = '' OR i.name ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_sort = 'new' THEN i.created_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'trending' OR p_sort IS NULL THEN i.sold_quantity END DESC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
