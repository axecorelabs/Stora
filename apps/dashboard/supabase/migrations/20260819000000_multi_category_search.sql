-- Multi-category browsing: a buyer can select several categories at once
-- (OR semantics -- a product only ever has one category, so "AND across
-- categories" isn't a meaningful thing to ask of it; a vendor selling ANY
-- of the selected categories is the intent too, matching "browse a range
-- of things" rather than narrowing to vendors who sell everything picked).
--
-- p_category TEXT -> p_categories TEXT[] is a parameter TYPE change, not
-- just an appended one -- CREATE OR REPLACE can't do that in place (a
-- lesson from 20260818000006: changing a signature via REPLACE leaves the
-- old version behind as an ambiguous overload instead of replacing it).
-- Drop the exact prior signatures first, then create fresh.

DROP FUNCTION IF EXISTS search_products(TEXT, TEXT, TEXT, INT, INT, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS search_vendors(TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT);

CREATE FUNCTION search_products(
  p_search TEXT DEFAULT NULL, p_categories TEXT[] DEFAULT NULL, p_sort TEXT DEFAULT 'trending',
  p_limit INT DEFAULT 24, p_offset INT DEFAULT 0, p_min_price NUMERIC DEFAULT NULL, p_max_price NUMERIC DEFAULT NULL,
  p_state TEXT DEFAULT NULL, p_buyer_state TEXT DEFAULT NULL
) RETURNS TABLE (product inventory, total_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT i, count(*) OVER()
  FROM inventory i
  JOIN stores st ON st.id = i.store_id AND st.is_active = true AND COALESCE((st.website->>'isEnabled')::boolean, false) = true
  WHERE i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR i.category = ANY(p_categories))
    AND (p_search IS NULL OR p_search = '' OR i.name ILIKE '%' || p_search || '%')
    AND (p_min_price IS NULL OR i.min_price >= p_min_price)
    AND (p_max_price IS NULL OR i.min_price <= p_max_price)
    AND (p_state IS NULL OR p_state = '' OR st.state = p_state)
  ORDER BY
    CASE WHEN p_sort = 'nearest' AND p_buyer_state IS NOT NULL AND p_buyer_state <> '' THEN
      CASE WHEN st.state = p_buyer_state THEN 0
           WHEN fn_ng_state_zone(st.state) IS NOT NULL AND fn_ng_state_zone(st.state) = fn_ng_state_zone(p_buyer_state) THEN 1
           ELSE 2 END
    END ASC NULLS LAST,
    CASE WHEN p_sort = 'new' THEN i.created_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'trending' OR p_sort IS NULL THEN i.sold_quantity END DESC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE FUNCTION search_vendors(
  p_search TEXT DEFAULT NULL, p_sort TEXT DEFAULT 'featured', p_limit INT DEFAULT 24, p_offset INT DEFAULT 0,
  p_categories TEXT[] DEFAULT NULL, p_state TEXT DEFAULT NULL, p_buyer_state TEXT DEFAULT NULL
) RETURNS TABLE (vendor stores, total_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND (p_search IS NULL OR p_search = '' OR s.store_name ILIKE '%' || p_search || '%')
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR EXISTS (
      SELECT 1 FROM inventory i WHERE i.store_id = s.id AND i.category = ANY(p_categories)
        AND i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    ))
    AND (p_state IS NULL OR p_state = '' OR s.state = p_state)
  ORDER BY
    CASE WHEN p_sort = 'nearest' AND p_buyer_state IS NOT NULL AND p_buyer_state <> '' THEN
      CASE WHEN s.state = p_buyer_state THEN 0
           WHEN fn_ng_state_zone(s.state) IS NOT NULL AND fn_ng_state_zone(s.state) = fn_ng_state_zone(p_buyer_state) THEN 1
           ELSE 2 END
    END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN s.store_name END ASC NULLS LAST,
    CASE WHEN p_sort = 'newest' THEN s.created_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'featured' OR p_sort IS NULL THEN s.total_orders END DESC NULLS LAST,
    s.average_rating DESC NULLS LAST, s.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

NOTIFY pgrst, 'reload schema';
