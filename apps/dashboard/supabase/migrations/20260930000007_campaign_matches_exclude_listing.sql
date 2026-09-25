-- A platform_mode='listing' store has no purchasable inventory by design
-- (showcase-only) and can't fulfill a campaign-driven order -- exclude it
-- defensively, same rule already applied to search_products/etc.
CREATE OR REPLACE FUNCTION fn_campaign_product_matches(
  p_campaign_id UUID,
  p_embedding vector(512),
  p_limit INT DEFAULT 12
) RETURNS TABLE (product inventory) LANGUAGE sql STABLE AS $$
  SELECT i FROM inventory i
  JOIN campaign_stores cs ON cs.campaign_id = p_campaign_id AND cs.store_id = i.store_id
  JOIN stores st ON st.id = i.store_id AND st.is_active = true AND st.is_partner = true
    AND COALESCE(st.platform_mode, 'store') <> 'listing'
  WHERE i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    AND i.embedding IS NOT NULL AND p_embedding IS NOT NULL
  ORDER BY i.embedding <=> p_embedding
  LIMIT p_limit;
$$;

NOTIFY pgrst, 'reload schema';
