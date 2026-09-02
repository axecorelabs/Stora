-- Generalizes campaigns from "exactly one vendor" to "one or more
-- vendors pooled into one campaign" (e.g. one "find your perfume" quiz
-- spanning several partner perfume vendors, so the AI recommendation has
-- a much larger real catalog to match against). No real campaigns exist
-- in production yet, so this is a clean cut: backfill the one existing
-- relationship into the new join table, then drop the old column,
-- rather than maintaining both shapes.
CREATE TABLE campaign_stores (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, store_id)
);
CREATE INDEX idx_campaign_stores_store_id ON campaign_stores(store_id);

INSERT INTO campaign_stores (campaign_id, store_id, added_at)
SELECT id, store_id, created_at FROM campaigns WHERE store_id IS NOT NULL;

ALTER TABLE campaigns DROP COLUMN store_id;

-- Marketing banner -- used both as the campaign page's Open Graph/social
-- share image and for on-site placement (homepage teaser, footers).
ALTER TABLE campaigns ADD COLUMN banner_url TEXT;

-- Attribution follows the actual recommended products, not campaign
-- membership (confirmed design principle) -- a vendor only owes the
-- elevated partner-contract commission on a sale if THEIR product was
-- one of the ones actually shown to THIS customer, never just because
-- they're in the same campaign pool as whoever was actually recommended.
-- One row per store among the distinct stores backing the recommended
-- products for that quiz completion -- not one row per campaign member.
CREATE TABLE campaign_attribution_stores (
  attribution_id UUID NOT NULL REFERENCES campaign_attributions(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  PRIMARY KEY (attribution_id, store_id)
);
-- Same shape as the index it replaces (idx_campaign_attributions_store_expiry)
-- needs: resolveCampaignAttribution looks up by attribution_id (already
-- resolved via the token) then joins here per store.
CREATE INDEX idx_campaign_attribution_stores_store_id ON campaign_attribution_stores(store_id);

INSERT INTO campaign_attribution_stores (attribution_id, store_id)
SELECT id, store_id FROM campaign_attributions WHERE store_id IS NOT NULL;

-- idx_campaign_attributions_store_expiry (store_id, expires_at) is dropped
-- along with the column -- resolveCampaignAttribution now looks up the
-- attribution by token/expiry first (idx unaffected, no store_id
-- involved), then joins campaign_attribution_stores separately.
ALTER TABLE campaign_attributions DROP COLUMN store_id;

-- Real embedding-similarity product matching for a campaign quiz,
-- replacing the tag-intersection heuristic (campaignScoring.js's
-- scoreProducts, kept as the fail-open fallback when an embedding call
-- fails). Mirrors search_products_ai's own filters exactly
-- (20260824000000), scoped to this campaign's pooled member stores via
-- campaign_stores instead of the whole marketplace, with the same
-- is_partner/is_active re-check the route already does defensively
-- elsewhere. A brand-new function (not modifying search_products_ai
-- itself), same discipline that migration's own comment already
-- explains the reasoning for.
CREATE FUNCTION fn_campaign_product_matches(
  p_campaign_id UUID,
  p_embedding vector(512),
  p_limit INT DEFAULT 12
) RETURNS TABLE (product inventory) LANGUAGE sql STABLE AS $$
  SELECT i FROM inventory i
  JOIN campaign_stores cs ON cs.campaign_id = p_campaign_id AND cs.store_id = i.store_id
  JOIN stores st ON st.id = i.store_id AND st.is_active = true AND st.is_partner = true
  WHERE i.is_active = true AND i.web_visibility = true AND i.is_deleted = false
    AND i.embedding IS NOT NULL AND p_embedding IS NOT NULL
  ORDER BY i.embedding <=> p_embedding
  LIMIT p_limit;
$$;

NOTIFY pgrst, 'reload schema';
