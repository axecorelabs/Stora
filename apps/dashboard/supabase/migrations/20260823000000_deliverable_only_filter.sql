-- Adds an opt-in hard filter, on top of the existing soft "nearest" sort
-- (20260818000005/20260819000000): when a buyer turns on "Deliverable to
-- me" on the storefront, this excludes vendors whose delivery_states is
-- set and doesn't include the buyer's state. A vendor with no
-- delivery_states (nationwide) always passes -- this is a real narrowing
-- filter, unlike p_state/nearest which never exclude anyone. Requires
-- both p_deliverable_only and a real p_buyer_state; either missing makes
-- this a no-op, matching p_buyer_state's existing "inert without it"
-- behavior for `nearest` above.
--
-- Appended params only (no type change to an existing one), so
-- CREATE OR REPLACE is safe here -- see 20260819000000's note on why that
-- migration needed DROP+CREATE instead.

CREATE OR REPLACE FUNCTION search_products(
  p_search TEXT DEFAULT NULL, p_categories TEXT[] DEFAULT NULL, p_sort TEXT DEFAULT 'trending',
  p_limit INT DEFAULT 24, p_offset INT DEFAULT 0, p_min_price NUMERIC DEFAULT NULL, p_max_price NUMERIC DEFAULT NULL,
  p_state TEXT DEFAULT NULL, p_buyer_state TEXT DEFAULT NULL, p_deliverable_only BOOLEAN DEFAULT false
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
    AND (
      p_deliverable_only IS NOT TRUE OR p_buyer_state IS NULL OR p_buyer_state = ''
      OR st.delivery_states IS NULL OR array_length(st.delivery_states, 1) IS NULL
      OR p_buyer_state = ANY(st.delivery_states)
    )
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

CREATE OR REPLACE FUNCTION search_vendors(
  p_search TEXT DEFAULT NULL, p_sort TEXT DEFAULT 'featured', p_limit INT DEFAULT 24, p_offset INT DEFAULT 0,
  p_categories TEXT[] DEFAULT NULL, p_state TEXT DEFAULT NULL, p_buyer_state TEXT DEFAULT NULL,
  p_deliverable_only BOOLEAN DEFAULT false
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
    AND (
      p_deliverable_only IS NOT TRUE OR p_buyer_state IS NULL OR p_buyer_state = ''
      OR s.delivery_states IS NULL OR array_length(s.delivery_states, 1) IS NULL
      OR p_buyer_state = ANY(s.delivery_states)
    )
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
