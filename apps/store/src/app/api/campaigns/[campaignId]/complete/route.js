import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { findInventoryByStoreId, findInventoryByIds } from "@/lib/supabaseStore";
import { embedText } from "@/lib/openrouter";
import { scoreProducts } from "@/lib/campaignScoring";

// Completes a campaign quiz: matches the pooled catalog of every still-
// eligible member vendor (a campaign can span several partner stores,
// see campaign_stores) against the customer's answers, records an
// attribution row scoped to only the stores actually recommended (see
// campaign_attribution_stores and campaignAttribution.js's own comment
// on why -- attribution follows the recommendation, never campaign
// membership), and sets the short-lived cookie orders/create/route.js
// later checks to apply each attributed vendor's own partner-contract
// rate. httpOnly (unlike stora_deliver_state, the closest precedent) --
// nothing client-side ever needs to read this token, only the server at
// checkout time.
export async function POST(request, { params }) {
  const { campaignId } = await params;

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id, status, config, attribution_window_hours")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign || campaign.status !== "active") {
    return NextResponse.json({ success: false, message: "Campaign not found" }, { status: 404 });
  }

  const { data: memberRows } = await supabaseAdmin
    .from("campaign_stores")
    .select("store_id")
    .eq("campaign_id", campaign.id);
  const memberStoreIds = (memberRows || []).map((r) => r.store_id);

  const { data: stores } = memberStoreIds.length
    ? await supabaseAdmin.from("stores").select("id, store_name, store_slug, is_partner, is_active").in("id", memberStoreIds)
    : { data: [] };

  // Defensive re-check -- a campaign left 'active' after every one of its
  // vendors' partner status was revoked must not keep producing new
  // attributions, even though computePaymentSplit would also
  // independently reject the rate at checkout time. Catching it here
  // means the customer isn't sent through a whole quiz for nothing.
  const eligibleStores = (stores || []).filter((s) => s.is_partner && s.is_active);
  if (eligibleStores.length === 0) {
    return NextResponse.json({ success: false, message: "This campaign is no longer available" }, { status: 404 });
  }

  let answers = {};
  try {
    ({ answers = {} } = await request.json());
  } catch {
    // No body / malformed JSON -- treat as no answers rather than 500ing;
    // scoring below just falls back to top sellers.
  }

  const questions = Array.isArray(campaign.config?.questions) ? campaign.config.questions : [];
  const selectedTags = [];
  const selectedLabels = [];
  for (const question of questions) {
    const selectedOptionId = answers[question.id];
    const option = (question.options || []).find((o) => o.id === selectedOptionId);
    if (option) {
      selectedTags.push(...(option.tags || []));
      selectedLabels.push(option.label);
    }
  }

  const maxRecommendations = campaign.config?.maxRecommendations || 3;

  // Real embedding-similarity matching across the pooled catalog (see
  // fn_campaign_product_matches, 20260904000000) -- falls back to the
  // tag-intersection heuristic (campaignScoring.js) exactly like the
  // AI-search feature already fails open on a missing key/timeout/bad
  // response, so results are never empty and this never 500s.
  let recommended = [];
  const queryText = selectedLabels.join(". ");
  const embedding = queryText ? await embedText(queryText) : null;
  if (embedding) {
    const { data: matches, error: matchError } = await supabaseAdmin.rpc("fn_campaign_product_matches", {
      p_campaign_id: campaign.id,
      p_embedding: embedding,
      p_limit: maxRecommendations
    });
    if (matchError) {
      console.error("Error matching campaign products via embedding (falling back to tag scoring):", matchError);
    } else if (matches && matches.length > 0) {
      const rankedIds = matches.map((row) => row.id);
      const products = await findInventoryByIds(rankedIds);
      const productsById = new Map(products.map((p) => [p.id, p]));
      recommended = rankedIds.map((id) => productsById.get(id)).filter(Boolean);
    }
  }

  if (recommended.length === 0) {
    const pooledProducts = (
      await Promise.all(eligibleStores.map((s) => findInventoryByStoreId(s.id)))
    ).flat();
    recommended = scoreProducts(pooledProducts, selectedTags, maxRecommendations);
  }

  const customerId = await verifyCustomerSession(request);
  const token = crypto.randomBytes(32).toString("hex");
  const windowHours = campaign.attribution_window_hours || 48;
  const expiresAt = new Date(Date.now() + windowHours * 60 * 60 * 1000);

  const { data: attributionRow, error: insertError } = await supabaseAdmin
    .from("campaign_attributions")
    .insert({
      campaign_id: campaign.id,
      customer_id: customerId || null,
      token,
      answers,
      recommended_product_ids: recommended.map((p) => p.id),
      expires_at: expiresAt.toISOString()
    })
    .select("id")
    .single();

  if (insertError || !attributionRow) {
    console.error("Error recording campaign attribution:", insertError);
    return NextResponse.json({ success: false, message: "Failed to complete campaign" }, { status: 500 });
  }

  // Attribution follows the recommendation, not campaign membership --
  // only the distinct stores actually backing the recommended products,
  // never every eligible member (see campaignAttribution.js).
  const recommendedStoreIds = [...new Set(recommended.map((p) => p.storeId))];
  if (recommendedStoreIds.length > 0) {
    const { error: attributionStoresError } = await supabaseAdmin
      .from("campaign_attribution_stores")
      .insert(recommendedStoreIds.map((storeId) => ({ attribution_id: attributionRow.id, store_id: storeId })));
    if (attributionStoresError) {
      console.error("Error recording campaign attribution stores:", attributionStoresError);
      return NextResponse.json({ success: false, message: "Failed to complete campaign" }, { status: 500 });
    }
  }

  const storeInfoById = new Map(eligibleStores.map((s) => [s.id, { storeName: s.store_name, storeSlug: s.store_slug }]));
  const response = NextResponse.json({
    success: true,
    recommendedProducts: recommended.map((p) => ({ ...p, ...(storeInfoById.get(p.storeId) || { storeName: null, storeSlug: null }) })),
    resultsHeading: campaign.config?.resultsHeading || "Your personalized picks",
    resultsIntro: campaign.config?.resultsIntro || "Based on your answers, here's what we recommend."
  });

  response.cookies.set("stora_campaign_attribution", token, {
    path: "/",
    maxAge: windowHours * 3600,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}
