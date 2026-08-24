-- Foundation for natural-language product/vendor search: vector embeddings
-- of each product's/store's descriptive text, plus new RPCs that rank by
-- embedding similarity instead of ILIKE keyword matching. Separate from
-- search_products/search_vendors -- not modifying those -- since this
-- codebase has hit the CREATE OR REPLACE-with-a-new-param trap three times
-- already (20260819000000, 20260823000002 comments); a brand-new function
-- for a brand-new query shape sidesteps that entirely and leaves the
-- existing keyword search completely stable.
CREATE EXTENSION IF NOT EXISTS vector;

-- 512 dims (via OpenRouter's text-embedding-3-small requested at reduced
-- dimensionality) -- a deliberate quality/storage/index-speed balance at
-- this app's current scale, not the model's native 1536.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS embedding vector(512);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS embedding vector(512);

-- HNSW over IVFFlat: no training/list-count tuning needed and stays
-- accurate as the catalog grows, which matters more than IVFFlat's
-- slightly cheaper build time at this scale.
CREATE INDEX IF NOT EXISTS idx_inventory_embedding ON inventory USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_stores_embedding ON stores USING hnsw (embedding vector_cosine_ops);

-- Mirrors search_products' own active/visibility/deliverability filters
-- exactly, swapping the ILIKE/sort logic for a similarity ORDER BY. A NULL
-- p_embedding (the embedding call failed upstream) returns nothing rather
-- than an arbitrary/undefined ordering -- callers must fall back to
-- keyword search in that case, not call this with a null vector.
CREATE FUNCTION search_products_ai(
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
  JOIN stores st ON st.id = i.store_id AND st.is_active = true AND COALESCE((st.website->>'isEnabled')::boolean, false) = true
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

CREATE FUNCTION search_vendors_ai(
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
    AND s.embedding IS NOT NULL
    AND p_embedding IS NOT NULL
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
