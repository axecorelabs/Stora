-- search_vendors()/search_products() (see 20260817000005) only checked
-- stores.is_active -- the account-level flag -- never website.isEnabled,
-- the per-storefront "publish/unpublish" toggle the dashboard's own
-- website-settings page already writes (apps/dashboard/.../website/toggle).
-- That toggle was consequently a no-op on every public listing: a vendor
-- (or an admin, directly) could disable a storefront and it would still
-- show up fully in vendor/product search. Add the same check the
-- storefront pages themselves now also enforce directly
-- (apps/store/src/app/[slug]/page.js and siblings check
-- store.website?.isEnabled before rendering).

CREATE OR REPLACE FUNCTION search_vendors(
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'featured',
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (vendor stores, total_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true
    AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND (p_search IS NULL OR p_search = '' OR s.store_name ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_sort = 'name' THEN s.store_name END ASC NULLS LAST,
    CASE WHEN p_sort = 'newest' THEN s.created_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'featured' OR p_sort IS NULL THEN s.total_orders END DESC NULLS LAST,
    s.average_rating DESC NULLS LAST,
    s.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

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
