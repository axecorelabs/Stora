-- Ranks a business higher on the 'featured'/default sort when it has real
-- profile data and/or an active paid subscription -- otherwise the
-- thousands of freshly OSM-seeded unclaimed stubs (all tied at
-- total_orders=0, average_rating=0) sort by created_at DESC as the last
-- tie-break, meaning "just seeded" would rank ahead of a real, complete,
-- paying business. Scoped to /vendors + the homepage's "Businesses on
-- Stora" section only -- /products already excludes platform_mode='listing'
-- entirely (unrelated, unchanged) and has nothing to rank here.
--
-- "Complete" = real street address + (phone or email) + logo.
-- "Paid" = either subscription column active -- mode-agnostic on purpose:
-- works for today's real listing subscribers and, once full-store billing
-- actually starts charging anyone (every real store-mode vendor is
-- currently full_store_subscription_status='none', confirmed live), for
-- those too, with no extra code needed later.
CREATE FUNCTION fn_store_ranking_boost(s stores) RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT
    (CASE WHEN COALESCE(s.address->>'street','') <> ''
           AND (COALESCE(s.store_phone,'') <> '' OR COALESCE(s.store_email,'') <> '')
           AND COALESCE(s.branding->>'logo','') <> ''
      THEN 1 ELSE 0 END)
    +
    (CASE WHEN s.subscription_status = 'active' OR s.full_store_subscription_status = 'active'
      THEN 1 ELSE 0 END);
$$;

-- Only the featured/default branch changes -- a customer who explicitly
-- asked for 'nearest' or 'name' sort shouldn't have that overridden by a
-- quality signal they didn't ask for.
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
    CASE WHEN p_sort = 'featured' OR p_sort IS NULL THEN fn_store_ranking_boost(s) END DESC NULLS LAST,
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

-- search_vendors_ai has no 'featured'/browse concept at all (pure
-- embedding-similarity order, no p_sort param) -- semantic relevance stays
-- untouched here on purpose, same reasoning as leaving 'nearest'/'name'
-- alone above.

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
    CASE WHEN p_sort = 'featured' OR p_sort IS NULL THEN fn_store_ranking_boost(s) END DESC NULLS LAST,
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

NOTIFY pgrst, 'reload schema';
