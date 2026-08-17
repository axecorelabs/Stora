-- Backend support for the /products price filter and the new /vendors
-- "sells {category}" filter.

-- min_price rollup, same trigger-maintained pattern as sold_quantity
-- (20260817000007): price lives per-variant (inventory_variants.price),
-- never on inventory itself, so filtering/sorting by price needs a real
-- column to index rather than a per-request join. Reuses the exact same
-- trigger set that already fires on every inventory_variants
-- insert/update/delete for sold_quantity -- just widens what that one
-- function computes, rather than adding a second trigger doing the same
-- table scan.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS min_price NUMERIC;

UPDATE inventory i SET min_price = (
  SELECT MIN(v.price) FROM inventory_variants v WHERE v.inventory_id = i.id AND v.is_active = true
);

CREATE INDEX IF NOT EXISTS idx_inventory_min_price
  ON inventory (min_price)
  WHERE is_active = true AND web_visibility = true AND is_deleted = false;

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
  ), 0),
  min_price = (
    SELECT MIN(price)
    FROM inventory_variants
    WHERE inventory_id = v_inventory_id AND is_active = true
  )
  WHERE id = v_inventory_id;
  RETURN NULL;
END;
$$;

-- search_products(): add optional price-range filter, reading the new
-- indexed column directly.
CREATE OR REPLACE FUNCTION search_products(
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'trending',
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL
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
    AND (p_min_price IS NULL OR i.min_price >= p_min_price)
    AND (p_max_price IS NULL OR i.min_price <= p_max_price)
  ORDER BY
    CASE WHEN p_sort = 'new' THEN i.created_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'trending' OR p_sort IS NULL THEN i.sold_quantity END DESC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- search_vendors(): add optional "sells this category" filter (EXISTS,
-- not a join, so a vendor with 50 matching products still only counts
-- once).
CREATE OR REPLACE FUNCTION search_vendors(
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'featured',
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (vendor stores, total_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true
    AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND (p_search IS NULL OR p_search = '' OR s.store_name ILIKE '%' || p_search || '%')
    AND (p_category IS NULL OR p_category = '' OR EXISTS (
      SELECT 1 FROM inventory i
      WHERE i.store_id = s.id
        AND i.category = p_category
        AND i.is_active = true
        AND i.web_visibility = true
        AND i.is_deleted = false
    ))
  ORDER BY
    CASE WHEN p_sort = 'name' THEN s.store_name END ASC NULLS LAST,
    CASE WHEN p_sort = 'newest' THEN s.created_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'featured' OR p_sort IS NULL THEN s.total_orders END DESC NULLS LAST,
    s.average_rating DESC NULLS LAST,
    s.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
