-- Add business subcategory-aware filtering to vendor keyword + AI search.
--
-- p_business_subcategory targets the primary subcategory field for strict
-- matches, while p_business_subcategories matches overlaps in the array
-- field (primary + secondary classification list).

DROP FUNCTION IF EXISTS public.search_vendors(text, text, integer, integer, text[], text, text, boolean, text, text);
DROP FUNCTION IF EXISTS public.search_vendors(text, text, integer, integer, text[], text, text, boolean, text, text, text, text[]);
DROP FUNCTION IF EXISTS public.search_vendors_ai(vector, text[], text, text, boolean, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.search_vendors_ai(vector, text[], text, text, boolean, integer, integer, text, text, text, text[]);

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

NOTIFY pgrst, 'reload schema';
