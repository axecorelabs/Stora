-- Biterave (the food-only storefront, apps/store/src/app/biterave/**)
-- needs real, indexed, paginated search -- not the JS-side "fetch
-- everything, slice client-side" shortcut its v1/v2 used, which breaks
-- the moment real LIMIT/OFFSET pagination is layered on top: Postgres
-- can't paginate correctly on a classification (meal vs. grocery) it
-- doesn't know about at query time. Same principle sold_quantity
-- denormalization already applies elsewhere in this schema (trigger-
-- maintained specifically so "trending" is one indexed ORDER BY, not a
-- JOIN+SUM per request) -- a real, indexed, SQL-level column, not a
-- runtime computation.

-- A vendor who fills in foodType (and the rest of the menu-item
-- sub-schema) is demonstrably building a real menu item; one who leaves
-- it blank picked "Food" as the closest matching top-level category for
-- a grocery/pantry item and never touched the food-specific fields --
-- see apps/store/src/lib/biteraveClassification.js's isMealItem(), which
-- this column makes queryable/indexable instead of a JS-only computation.
ALTER TABLE inventory ADD COLUMN is_meal_item BOOLEAN GENERATED ALWAYS AS (
  category = 'Food' AND NULLIF(TRIM(category_details->'food'->>'foodType'), '') IS NOT NULL
) STORED;

-- Same shape as the existing idx_inventory_discoverable_new partial index
-- -- scoped to exactly the rows Biterave's own queries below ever touch.
CREATE INDEX IF NOT EXISTS idx_inventory_food_meal ON inventory (is_meal_item)
  WHERE category = 'Food' AND is_active = true AND web_visibility = true AND is_deleted = false;

-- cuisineType is a JSON array (e.g. ["Nigerian","Fast Food"]) -- GIN over
-- the raw jsonb path supports `@>` containment, same technique
-- idx_stores_delivery_states already uses for an array-containment filter.
CREATE INDEX IF NOT EXISTS idx_inventory_food_cuisine ON inventory
  USING GIN ((category_details->'food'->'cuisineType'));

-- Mirrors search_products (20260823000001) exactly, except the category
-- filter is hard-scoped to 'Food' + is_meal_item (never caller-supplied --
-- Biterave's whole premise is a food-only storefront, so this can't be a
-- soft preference) and cuisine is a new optional containment filter.
CREATE FUNCTION search_biterave_products(
  p_meal_only BOOLEAN,
  p_search TEXT DEFAULT NULL,
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

-- Mirrors search_products_ai (20260824000000) the same way.
CREATE FUNCTION search_biterave_products_ai(
  p_meal_only BOOLEAN,
  p_embedding vector(512),
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

-- Mirrors search_vendors (20260823000001) exactly, swapping its
-- `i.category = ANY(p_categories)` EXISTS check for the same
-- Food + is_meal_item pair search_biterave_products uses directly.
CREATE FUNCTION search_biterave_vendors(
  p_meal_only BOOLEAN,
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'featured',
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0,
  p_state TEXT DEFAULT NULL,
  p_buyer_state TEXT DEFAULT NULL,
  p_deliverable_only BOOLEAN DEFAULT false
) RETURNS TABLE (vendor stores, total_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND EXISTS (
      SELECT 1 FROM inventory i WHERE i.store_id = s.id
        AND i.category = 'Food' AND i.is_meal_item = p_meal_only
        AND i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    )
    AND (p_search IS NULL OR p_search = '' OR s.store_name ILIKE '%' || p_search || '%')
    AND (p_state IS NULL OR p_state = '' OR s.state = p_state)
    AND (
      p_deliverable_only IS NOT TRUE OR p_buyer_state IS NULL OR p_buyer_state = ''
      OR s.delivery_states IS NULL OR array_length(s.delivery_states, 1) IS NULL
      OR s.delivery_states @> ARRAY[p_buyer_state]
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

-- Mirrors search_vendors_ai (20260824000001) the same way.
CREATE FUNCTION search_biterave_vendors_ai(
  p_meal_only BOOLEAN,
  p_embedding vector(512),
  p_state TEXT DEFAULT NULL,
  p_buyer_state TEXT DEFAULT NULL,
  p_deliverable_only BOOLEAN DEFAULT false,
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
) RETURNS TABLE (vendor stores, total_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND s.embedding IS NOT NULL AND p_embedding IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM inventory i WHERE i.store_id = s.id
        AND i.category = 'Food' AND i.is_meal_item = p_meal_only
        AND i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    )
    AND (p_state IS NULL OR p_state = '' OR s.state = p_state)
    AND (
      p_deliverable_only IS NOT TRUE OR p_buyer_state IS NULL OR p_buyer_state = ''
      OR s.delivery_states IS NULL OR array_length(s.delivery_states, 1) IS NULL
      OR s.delivery_states @> ARRAY[p_buyer_state]
    )
  ORDER BY s.embedding <=> p_embedding
  LIMIT p_limit OFFSET p_offset;
$$;

NOTIFY pgrst, 'reload schema';
