-- search_vendors_ai ranked purely by the vendor's own store_name/
-- store_description embedding, with no check on what that vendor's
-- inventory actually contains -- so "a vendor that sells books" could
-- surface a vendor whose blurb happens to read similarly in tone/wording
-- but doesn't carry a single book. search_products_ai already applies the
-- extracted category as a hard filter; search_vendors_ai never did.
-- Mirrors the same EXISTS-against-inventory check search_vendors (the
-- keyword version) already uses for exactly this reason.
--
-- Adding a parameter, not just changing logic -- DROP the exact old
-- signature first (this codebase's own hard-learned lesson: CREATE OR
-- REPLACE with a new param creates a second overload instead of replacing
-- it -- 20260819000000, 20260823000002).
DROP FUNCTION IF EXISTS search_vendors_ai(vector(512), TEXT, TEXT, BOOLEAN, INT, INT);

CREATE FUNCTION search_vendors_ai(
  p_embedding vector(512),
  p_categories TEXT[] DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_buyer_state TEXT DEFAULT NULL,
  p_deliverable_only BOOLEAN DEFAULT false,
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
) RETURNS TABLE (vendor stores, total_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT s, count(*) OVER()
  FROM stores s
  WHERE s.is_active = true AND COALESCE((s.website->>'isEnabled')::boolean, false) = true
    AND s.embedding IS NOT NULL
    AND p_embedding IS NOT NULL
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR EXISTS (
      SELECT 1 FROM inventory i WHERE i.store_id = s.id AND i.category = ANY(p_categories)
        AND i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    ))
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
