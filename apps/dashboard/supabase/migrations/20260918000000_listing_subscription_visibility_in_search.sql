-- Hide unpaid listing-mode businesses from all public vendor/search surfaces.
--
-- platform_mode/subscription_status were added in
-- 20260917000000_business_listings.sql. Public search had only
-- (is_active + website.isEnabled), so listing-mode stores still appeared
-- before payment. Add the same visibility rule everywhere:
--
--   platform_mode <> 'listing' OR subscription_status = 'active'
--
-- i.e. full stores are unaffected; listing stores must have an active
-- subscription to be discoverable or publicly browsable.

CREATE OR REPLACE FUNCTION public.search_vendors(
  p_search text DEFAULT NULL::text,
  p_sort text DEFAULT 'featured'::text,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_categories text[] DEFAULT NULL::text[],
  p_state text DEFAULT NULL::text,
  p_buyer_state text DEFAULT NULL::text,
  p_deliverable_only boolean DEFAULT false,
  p_scope text DEFAULT NULL::text
)
 RETURNS TABLE(vendor stores, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true
    AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND (COALESCE(s.platform_mode, 'store') <> 'listing' OR s.subscription_status = 'active')
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
  p_scope text DEFAULT NULL::text
)
 RETURNS TABLE(vendor stores, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true
    AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND (COALESCE(s.platform_mode, 'store') <> 'listing' OR s.subscription_status = 'active')
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
    AND (COALESCE(s.platform_mode, 'store') <> 'listing' OR s.subscription_status = 'active')
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
    AND (COALESCE(s.platform_mode, 'store') <> 'listing' OR s.subscription_status = 'active')
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

-- One-time backfill: if a listing is not actively subscribed, force
-- website.isEnabled=false so state matches subscription visibility.
UPDATE stores
SET
  website = COALESCE(website, '{}'::jsonb) || jsonb_build_object('isEnabled', false),
  updated_at = NOW()
WHERE platform_mode = 'listing'
  AND subscription_status <> 'active'
  AND COALESCE((website->>'isEnabled')::boolean, false) = true;

NOTIFY pgrst, 'reload schema';
