-- /biterave/[storeSlug] (one restaurant's own menu) only had a plain
-- client-side text filter, no AI search, unlike /biterave/meals and
-- /biterave/groceries -- a real inconsistency, not a deliberate scope cut.
-- search_biterave_products_ai needs an optional store scope to support it;
-- adding a parameter, not just changing logic -- DROP the exact old
-- signature first (this codebase's own hard-learned lesson: CREATE OR
-- REPLACE with a new param creates a second overload instead of replacing
-- it -- 20260819000000, 20260823000002, 20260824000001).
DROP FUNCTION IF EXISTS search_biterave_products_ai(
  BOOLEAN, vector(512), TEXT, NUMERIC, NUMERIC, TEXT, TEXT, BOOLEAN, INT, INT
);

CREATE FUNCTION search_biterave_products_ai(
  p_meal_only BOOLEAN,
  p_embedding vector(512),
  p_store_id UUID DEFAULT NULL,
  p_cuisine TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_buyer_state TEXT DEFAULT NULL,
  p_deliverable_only BOOLEAN DEFAULT false,
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
) RETURNS TABLE (product inventory, total_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT i, count(*) OVER()
  FROM inventory i
  JOIN stores st ON st.id = i.store_id AND st.is_active = true AND COALESCE((st.website->>'isEnabled')::boolean, false) = true
  WHERE i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    AND i.embedding IS NOT NULL AND p_embedding IS NOT NULL
    AND i.category = 'Food' AND i.is_meal_item = p_meal_only
    AND (p_store_id IS NULL OR i.store_id = p_store_id)
    AND (p_cuisine IS NULL OR p_cuisine = '' OR i.category_details->'food'->'cuisineType' @> jsonb_build_array(p_cuisine))
    AND (p_min_price IS NULL OR i.min_price >= p_min_price)
    AND (p_max_price IS NULL OR i.min_price <= p_max_price)
    AND (p_state IS NULL OR p_state = '' OR st.state = p_state)
    AND (
      p_deliverable_only IS NOT TRUE OR p_buyer_state IS NULL OR p_buyer_state = ''
      OR st.delivery_states IS NULL OR array_length(st.delivery_states, 1) IS NULL
      OR st.delivery_states @> ARRAY[p_buyer_state]
    )
  ORDER BY i.embedding <=> p_embedding
  LIMIT p_limit OFFSET p_offset;
$$;

-- Same store scope added to the plain keyword function -- when AI
-- extraction fails and the route falls back to keyword search on a
-- single restaurant's own page, results must stay scoped to that store
-- too, not silently widen to the whole Biterave catalog.
DROP FUNCTION IF EXISTS search_biterave_products(
  BOOLEAN, TEXT, TEXT, TEXT, INT, INT, NUMERIC, NUMERIC, TEXT, TEXT, BOOLEAN
);

CREATE FUNCTION search_biterave_products(
  p_meal_only BOOLEAN,
  p_search TEXT DEFAULT NULL,
  p_store_id UUID DEFAULT NULL,
  p_cuisine TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'trending',
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_buyer_state TEXT DEFAULT NULL,
  p_deliverable_only BOOLEAN DEFAULT false
) RETURNS TABLE (product inventory, total_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT i, count(*) OVER()
  FROM inventory i
  JOIN stores st ON st.id = i.store_id AND st.is_active = true AND COALESCE((st.website->>'isEnabled')::boolean, false) = true
  WHERE i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    AND i.category = 'Food' AND i.is_meal_item = p_meal_only
    AND (p_store_id IS NULL OR i.store_id = p_store_id)
    AND (p_search IS NULL OR p_search = '' OR i.name ILIKE '%' || p_search || '%')
    AND (p_cuisine IS NULL OR p_cuisine = '' OR i.category_details->'food'->'cuisineType' @> jsonb_build_array(p_cuisine))
    AND (p_min_price IS NULL OR i.min_price >= p_min_price)
    AND (p_max_price IS NULL OR i.min_price <= p_max_price)
    AND (p_state IS NULL OR p_state = '' OR st.state = p_state)
    AND (
      p_deliverable_only IS NOT TRUE OR p_buyer_state IS NULL OR p_buyer_state = ''
      OR st.delivery_states IS NULL OR array_length(st.delivery_states, 1) IS NULL
      OR st.delivery_states @> ARRAY[p_buyer_state]
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

NOTIFY pgrst, 'reload schema';
