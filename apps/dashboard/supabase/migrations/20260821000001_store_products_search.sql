-- Server-side search/filter/sort/pagination for ONE vendor's own product
-- listing (apps/store/src/app/[slug]/products/page.js), used only once a
-- store's catalog crosses a size threshold where fetching everything and
-- filtering client-side stops being the right call. Deliberately a new,
-- separate function rather than widening search_products() -- that one is
-- cross-vendor only (joins stores, has no store scope at all) and has
-- already been through several signature changes this session; this
-- needs none of its trending/proximity logic. Mirrors its exact shape
-- (RETURNS TABLE(product inventory, total_count BIGINT), CASE WHEN sort
-- chain, count(*) OVER()) so the calling JS pattern in supabaseStore.js
-- (attachVariants + transformInventoryToProduct + enrichProductsWithBatches
-- run on the returned rows afterward, same as searchProductsPaginated
-- already does) stays identical either way.
--
-- Price sort reuses inventory.min_price -- already a trigger-maintained,
-- indexed rollup of inventory_variants.price (see
-- 20260818000003_price_filter_and_vendor_category.sql) -- rather than
-- computing anything new. It's a deliberate proxy for "starting price,"
-- not the FIFO-resolved batch price enrichProductsWithBatches computes
-- afterward for the actual displayed price on whatever page comes back;
-- only the sort *order* uses this simpler, already-indexed value.
CREATE FUNCTION fn_store_products_search(
  p_store_id UUID,
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'default', -- default | price-low | price-high | name-az | name-za
                                  -- (exact keys ProductsPageClient.js's client-mode sort already uses)
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
) RETURNS TABLE (product inventory, total_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT i, count(*) OVER()
  FROM inventory i
  WHERE i.store_id = p_store_id
    AND i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    AND (p_category IS NULL OR p_category = '' OR p_category = 'all' OR i.category = p_category)
    -- Same field set the current client-side search already checks
    -- (ProductsPageClient.js's useMemo filter), so switching modes doesn't
    -- change what a search term matches.
    AND (p_search IS NULL OR p_search = '' OR
      i.name ILIKE '%' || p_search || '%' OR
      i.category ILIKE '%' || p_search || '%' OR
      i.brand ILIKE '%' || p_search || '%' OR
      i.sku ILIKE '%' || p_search || '%' OR
      i.description ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_sort = 'price-low' THEN i.min_price END ASC NULLS LAST,
    CASE WHEN p_sort = 'price-high' THEN i.min_price END DESC NULLS LAST,
    CASE WHEN p_sort = 'name-az' THEN i.name END ASC NULLS LAST,
    CASE WHEN p_sort = 'name-za' THEN i.name END DESC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- The category pill row's option list -- server-mode never holds the full
-- catalog in memory to derive this from client-side the way today's
-- client-mode useMemo does, so it needs its own cheap query. A real
-- SELECT DISTINCT, not a "fetch everything, dedupe in JS" workaround,
-- which would defeat the entire point for a large catalog.
CREATE FUNCTION fn_store_categories(p_store_id UUID)
RETURNS TABLE (category TEXT) LANGUAGE sql STABLE AS $$
  SELECT DISTINCT i.category
  FROM inventory i
  WHERE i.store_id = p_store_id
    AND i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    AND i.category IS NOT NULL
  ORDER BY i.category;
$$;

NOTIFY pgrst, 'reload schema';
