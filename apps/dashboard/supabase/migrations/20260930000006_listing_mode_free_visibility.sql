-- Listing-mode stores (platform_mode='listing') no longer need an active
-- subscription to exist publicly -- see isPubliclyVisibleStore() in
-- apps/store/src/lib/supabaseStore.js for the full rationale. Subscription
-- now gates specific premium features (reviews, gallery, precise
-- location) inside the page itself, not whether it's visible at all.
-- Search must match: drop the same subscription clause from every vendor
-- search function that previously required it.

CREATE OR REPLACE FUNCTION public.search_vendors(
  p_search text DEFAULT NULL::text,
  p_sort text DEFAULT 'featured'::text,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_categories text[] DEFAULT NULL::text[],
  p_state text DEFAULT NULL::text,
  p_buyer_state text DEFAULT NULL::text,
  p_deliverable_only boolean DEFAULT false,
  p_scope text DEFAULT NULL::text,
  p_business_category text DEFAULT NULL::text,
  p_business_subcategory text DEFAULT NULL::text,
  p_business_subcategories text[] DEFAULT NULL::text[]
)
 RETURNS TABLE(vendor stores, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true
    AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND (p_search IS NULL OR p_search = '' OR s.store_name ILIKE '%' || p_search || '%')
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR EXISTS (
      SELECT 1 FROM inventory i WHERE i.store_id = s.id AND i.category = ANY(p_categories)
        AND i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    ) OR EXISTS (
      SELECT 1 FROM service_items si
      JOIN services sv ON sv.id = si.service_id
      WHERE sv.store_id = s.id AND si.category = ANY(p_categories) AND si.is_active = true
    ))
    AND (p_state IS NULL OR p_state = '' OR s.state = p_state)
    AND (
      p_deliverable_only IS NOT TRUE OR p_buyer_state IS NULL OR p_buyer_state = ''
      OR s.delivery_states IS NULL OR array_length(s.delivery_states, 1) IS NULL
      OR s.delivery_states @> ARRAY[p_buyer_state]
    )
    AND (
      p_scope IS NULL OR p_scope = ''
      OR (p_scope = 'products' AND (s.sells_products = true OR s.restaurant_mode = true))
      OR (p_scope = 'services' AND s.offers_services = true)
    )
    AND (
      p_business_category IS NULL OR p_business_category = ''
      OR s.business_category = p_business_category
      OR (p_business_category = 'restaurant' AND s.restaurant_mode = true)
    )
    AND (
      p_business_subcategory IS NULL OR p_business_subcategory = ''
      OR s.business_subcategory = p_business_subcategory
      OR (s.business_subcategories IS NOT NULL AND s.business_subcategories @> ARRAY[p_business_subcategory])
    )
    AND (
      p_business_subcategories IS NULL OR array_length(p_business_subcategories, 1) IS NULL
      OR (s.business_subcategories IS NOT NULL AND s.business_subcategories && p_business_subcategories)
      OR (s.business_subcategory IS NOT NULL AND s.business_subcategory = ANY(p_business_subcategories))
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
$function$;

CREATE OR REPLACE FUNCTION public.search_vendors_ai(
  p_embedding vector,
  p_categories text[] DEFAULT NULL::text[],
  p_state text DEFAULT NULL::text,
  p_buyer_state text DEFAULT NULL::text,
  p_deliverable_only boolean DEFAULT false,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_scope text DEFAULT NULL::text,
  p_business_category text DEFAULT NULL::text,
  p_business_subcategory text DEFAULT NULL::text,
  p_business_subcategories text[] DEFAULT NULL::text[]
)
 RETURNS TABLE(vendor stores, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true
    AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND s.embedding IS NOT NULL
    AND p_embedding IS NOT NULL
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR EXISTS (
      SELECT 1 FROM inventory i WHERE i.store_id = s.id AND i.category = ANY(p_categories)
        AND i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    ) OR EXISTS (
      SELECT 1 FROM service_items si
      JOIN services sv ON sv.id = si.service_id
      WHERE sv.store_id = s.id AND si.category = ANY(p_categories) AND si.is_active = true
    ))
    AND (p_state IS NULL OR p_state = '' OR s.state = p_state)
    AND (
      p_deliverable_only IS NOT TRUE OR p_buyer_state IS NULL OR p_buyer_state = ''
      OR s.delivery_states IS NULL OR array_length(s.delivery_states, 1) IS NULL
      OR s.delivery_states @> ARRAY[p_buyer_state]
    )
    AND (
      p_scope IS NULL OR p_scope = ''
      OR (p_scope = 'products' AND (s.sells_products = true OR s.restaurant_mode = true))
      OR (p_scope = 'services' AND s.offers_services = true)
    )
    AND (
      p_business_category IS NULL OR p_business_category = ''
      OR s.business_category = p_business_category
      OR (p_business_category = 'restaurant' AND s.restaurant_mode = true)
    )
    AND (
      p_business_subcategory IS NULL OR p_business_subcategory = ''
      OR s.business_subcategory = p_business_subcategory
      OR (s.business_subcategories IS NOT NULL AND s.business_subcategories @> ARRAY[p_business_subcategory])
    )
    AND (
      p_business_subcategories IS NULL OR array_length(p_business_subcategories, 1) IS NULL
      OR (s.business_subcategories IS NOT NULL AND s.business_subcategories && p_business_subcategories)
      OR (s.business_subcategory IS NOT NULL AND s.business_subcategory = ANY(p_business_subcategories))
    )
  ORDER BY s.embedding <=> p_embedding
  LIMIT p_limit OFFSET p_offset;
$function$;

CREATE OR REPLACE FUNCTION public.search_biterave_vendors(
  p_meal_only boolean,
  p_search text DEFAULT NULL::text,
  p_sort text DEFAULT 'featured'::text,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_state text DEFAULT NULL::text,
  p_buyer_state text DEFAULT NULL::text,
  p_deliverable_only boolean DEFAULT false
)
 RETURNS TABLE(vendor stores, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true
    AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
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
$function$;

CREATE OR REPLACE FUNCTION public.search_biterave_vendors_ai(
  p_meal_only boolean,
  p_embedding vector(512),
  p_state text DEFAULT NULL::text,
  p_buyer_state text DEFAULT NULL::text,
  p_deliverable_only boolean DEFAULT false,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
 RETURNS TABLE(vendor stores, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true
    AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
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
$function$;

-- Two pre-existing gaps found while auditing every visibility gate for
-- this change (unrelated to the subscription rule above, but adjacent and
-- cheap to fix here): search_biterave_products/_ai never got the "exclude
-- listing mode entirely from product surfaces" rule that search_products
-- already has (20260921000001_exclude_listing_mode_from_product_surfaces.sql).
-- A listing-mode store has no purchasable inventory by design; this only
-- matters for the edge case of a store that switched from 'store' to
-- 'listing' mode after already having food inventory.
DROP FUNCTION IF EXISTS search_biterave_products_ai(
  BOOLEAN, vector(512), UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, BOOLEAN, INT, INT
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
  JOIN stores st ON st.id = i.store_id AND st.is_active = true
    AND COALESCE((st.website->>'isEnabled')::boolean, false) = true
    AND COALESCE(st.platform_mode, 'store') <> 'listing'
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

DROP FUNCTION IF EXISTS search_biterave_products(
  BOOLEAN, TEXT, UUID, TEXT, TEXT, INT, INT, NUMERIC, NUMERIC, TEXT, TEXT, BOOLEAN
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
  JOIN stores st ON st.id = i.store_id AND st.is_active = true
    AND COALESCE((st.website->>'isEnabled')::boolean, false) = true
    AND COALESCE(st.platform_mode, 'store') <> 'listing'
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

-- gallery_items RLS: was missing an is_active check (a deactivated but
-- still-subscribed listing store's gallery shouldn't stay publicly
-- readable).
DROP POLICY IF EXISTS "Public read gallery items" ON gallery_items;
CREATE POLICY "Public read gallery items" ON gallery_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = gallery_items.store_id
        AND stores.is_active = true
        AND stores.platform_mode = 'listing'
        AND stores.subscription_status = 'active'
    )
  );

NOTIFY pgrst, 'reload schema';
