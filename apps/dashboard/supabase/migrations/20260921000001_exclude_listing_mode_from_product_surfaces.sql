-- Listing-mode businesses should render via ListingShowcase only.
-- Keep them out of global product surfaces (/products and AI product search)
-- even when their listing website is enabled.

CREATE OR REPLACE FUNCTION search_products(
  p_search TEXT DEFAULT NULL, p_categories TEXT[] DEFAULT NULL, p_sort TEXT DEFAULT 'trending',
  p_limit INT DEFAULT 24, p_offset INT DEFAULT 0, p_min_price NUMERIC DEFAULT NULL, p_max_price NUMERIC DEFAULT NULL,
  p_state TEXT DEFAULT NULL, p_buyer_state TEXT DEFAULT NULL, p_deliverable_only BOOLEAN DEFAULT false
) RETURNS TABLE (product inventory, total_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT i, count(*) OVER()
  FROM inventory i
  JOIN stores st
    ON st.id = i.store_id
   AND st.is_active = true
   AND COALESCE((st.website->>'isEnabled')::boolean, false) = true
   AND COALESCE(st.platform_mode, 'store') <> 'listing'
  WHERE i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR i.category = ANY(p_categories))
    AND (p_search IS NULL OR p_search = '' OR i.name ILIKE '%' || p_search || '%')
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

CREATE OR REPLACE FUNCTION search_products_ai(
  p_embedding vector(512),
  p_categories TEXT[] DEFAULT NULL,
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
  JOIN stores st
    ON st.id = i.store_id
   AND st.is_active = true
   AND COALESCE((st.website->>'isEnabled')::boolean, false) = true
   AND COALESCE(st.platform_mode, 'store') <> 'listing'
  WHERE i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    AND i.embedding IS NOT NULL
    AND p_embedding IS NOT NULL
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR i.category = ANY(p_categories))
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

NOTIFY pgrst, 'reload schema';