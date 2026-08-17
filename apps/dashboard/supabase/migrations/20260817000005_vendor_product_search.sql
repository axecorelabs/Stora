-- Search infrastructure for the storefront's dedicated /vendors and
-- /products pages (see apps/store). Existing discovery endpoints
-- (findFeaturedStores/findDiscoverableProducts) fetch a small, cached
-- candidate pool for homepage teasers -- fine at that scale, but a real
-- search/browse page needs indexed text search and DB-side pagination to
-- stay fast at hundreds of vendors and thousands of products, rather than
-- pulling ever-larger candidate pools into JS to filter/sort/slice.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN indexes: unlike a btree index, these accelerate
-- ILIKE '%term%' (leading-wildcard) lookups, which is the substring-match
-- behavior the app's search already uses everywhere else.
CREATE INDEX IF NOT EXISTS idx_stores_store_name_trgm
  ON stores USING gin (store_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_inventory_name_trgm
  ON inventory USING gin (name gin_trgm_ops);

-- Partial indexes matching each page's base WHERE filter + default sort,
-- so the common case (no search term, default sort, first page) is a
-- single indexed scan rather than a filtered sequential scan.
CREATE INDEX IF NOT EXISTS idx_stores_featured
  ON stores (total_orders DESC, average_rating DESC, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_inventory_discoverable_new
  ON inventory (created_at DESC)
  WHERE is_active = true AND web_visibility = true AND is_deleted = false;

-- Paginated, indexed vendor search for /vendors. Returns the full `stores`
-- row (as a composite column) plus a running total_count via count(*)
-- OVER(), so the caller gets pagination metadata in the same round trip
-- instead of a separate COUNT(*) query.
CREATE OR REPLACE FUNCTION search_vendors(
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'featured', -- 'featured' | 'newest' | 'name'
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (vendor stores, total_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true
    AND (p_search IS NULL OR p_search = '' OR s.store_name ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_sort = 'name' THEN s.store_name END ASC NULLS LAST,
    CASE WHEN p_sort = 'newest' THEN s.created_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'featured' OR p_sort IS NULL THEN s.total_orders END DESC NULLS LAST,
    s.average_rating DESC NULLS LAST,
    s.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- Paginated, indexed product search for /products. `sold_quantity` lives
-- per-variant (inventory_variants), not on inventory itself (and
-- inventory.sold_quantity is a stale pre-migration column -- see
-- 20260817000001_unify_inventory_variants.sql), so "trending" is computed
-- via a rollup join here rather than trusting any column on inventory
-- directly. The join aggregates over inventory_variants with no row limit,
-- which is deliberate: at this scale (thousands of products, a handful of
-- variants each) a HashAggregate over the whole table is still a
-- single-digit-millisecond operation, and it's the only way to get a
-- correct DB-side ORDER BY + LIMIT/OFFSET for trending instead of pulling
-- every match into JS to sort.
CREATE OR REPLACE FUNCTION search_products(
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'trending', -- 'trending' | 'new'
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (product inventory, total_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT i, count(*) OVER()
  FROM inventory i
  LEFT JOIN (
    SELECT inventory_id, SUM(sold_quantity) AS total_sold
    FROM inventory_variants
    WHERE is_active = true
    GROUP BY inventory_id
  ) v ON v.inventory_id = i.id
  WHERE i.is_active = true
    AND i.web_visibility = true
    AND i.is_deleted = false
    AND (p_category IS NULL OR p_category = '' OR i.category = p_category)
    AND (p_search IS NULL OR p_search = '' OR i.name ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_sort = 'new' THEN i.created_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'trending' OR p_sort IS NULL THEN COALESCE(v.total_sold, 0) END DESC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
