-- Consolidates vendor + service-provider search: search_vendors/
-- search_vendors_ai's category filter only ever checked inventory, so a
-- pure-services business (no inventory rows) could never be found by
-- category even though it already appeared in the base, unfiltered
-- listing (that only requires is_active + website.isEnabled, no product
-- ownership). Adds a second EXISTS branch against service_items (joined
-- through services for its store_id) alongside the existing inventory
-- check -- product and service category taxonomies never share string
-- values, so this can't cross-match a product category against a service
-- vendor or vice versa.
--
-- Also adds an optional p_scope ('products' | 'services' | NULL) so the
-- new /vendors scope toggle can narrow to just one business type even
-- with no category picked, using the sells_products/offers_services
-- booleans added in the business-type migration. NULL (the default,
-- and every existing caller before this migration) preserves today's
-- behavior exactly.
--
-- CREATE OR REPLACE matches on the exact parameter type list -- adding a
-- new parameter doesn't replace the old function, it silently creates a
-- second overload alongside it (the exact ambiguity failure documented in
-- 20260823000002_drop_ambiguous_search_overloads.sql). Drop the old
-- 8-arg/7-arg signatures explicitly first so only the new one remains.
DROP FUNCTION IF EXISTS public.search_vendors(text, text, integer, integer, text[], text, text, boolean);
DROP FUNCTION IF EXISTS public.search_vendors_ai(vector, text[], text, text, boolean, integer, integer);

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
  WHERE s.is_active = true AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
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
  WHERE s.is_active = true AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
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

NOTIFY pgrst, 'reload schema';
