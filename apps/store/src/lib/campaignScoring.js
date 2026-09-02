// Fallback scorer for a campaign quiz -- primary matching is real
// embedding similarity (fn_campaign_product_matches, called from
// api/campaigns/[campaignId]/complete/route.js via lib/openrouter.js's
// embedText), which this only backs up when that fails (no API key, a
// timeout, a bad response) so results are never empty. Deliberately
// simple (tag-intersection count) for that fail-open path -- no LLM call
// to retry or reason about when things are already going wrong upstream.
//
// Ties broken by sold_quantity desc (an already-available popularity
// signal) so results are never arbitrary. If nothing scores above 0 (a
// poorly-tagged catalog, or a genuinely mismatched combination of
// answers), falls back to the pooled catalog's top sellers so the
// results screen is never empty.
export function scoreProducts(products, selectedTags, maxRecommendations = 3) {
  const tagSet = new Set(selectedTags);

  const scored = (products || []).map((product) => {
    const productTags = Array.isArray(product.tags) ? product.tags : [];
    const score = productTags.reduce((count, tag) => count + (tagSet.has(tag) ? 1 : 0), 0);
    return { product, score };
  });

  const withMatches = scored.filter((s) => s.score > 0);
  const ranked = (withMatches.length > 0 ? withMatches : scored)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.product.soldQuantity || 0) - (a.product.soldQuantity || 0);
    })
    .slice(0, maxRecommendations)
    .map((s) => s.product);

  return ranked;
}
