import { supabaseAdmin } from "./supabase";

// Resolves the stora_campaign_attribution cookie (set by
// /api/campaigns/[campaignId]/complete) to a live, unexpired attribution,
// joined per-store to each currently-accepted partner_contracts row (if
// any). Shared by orders/create/route.js's computePaymentSplit AND
// supabaseCart.js's enrichCartWithProductData, so a customer's cart
// preview and their actual charge at checkout can never drift apart --
// previously this was only ever resolved at order-creation time, which is
// exactly what let the cart preview quote a lower total than what
// actually got charged for a partner-attributed sale.
//
// Deliberately MULTI-USE: expires_at is the only validity check -- every
// order placed with an attributed store before the attribution expires
// earns the partner rate, not just the first, so there's no "already
// used" filter here at all. is_partner and the contract's 'accepted'
// status are both re-checked live (not trusted from whenever the
// attribution was created) -- if Stora staff terminate a vendor's
// contract in between, the elevated rate stops applying immediately,
// even if an unexpired attribution for them still exists.
//
// A campaign can pool several vendors, but attribution follows the
// actual recommendation, not campaign membership (confirmed design
// principle) -- campaign_attribution_stores holds one row per store
// whose product was actually among the recommendations shown for that
// quiz completion, not one row per campaign member. A vendor who was
// never recommended to this customer can never earn (or be charged) the
// elevated rate on an unrelated sale, even if they're in the same
// campaign pool as whoever was recommended.
//
// Returns a Map<storeId, { attribution, contract }> -- one entry per
// store that was both actually recommended AND still eligible right now.
export async function resolveCampaignAttribution(request) {
  const token = request.cookies.get("stora_campaign_attribution")?.value;
  if (!token) return new Map();

  const { data: attribution } = await supabaseAdmin
    .from("campaign_attributions")
    .select("id, expires_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!attribution) return new Map();

  const { data: attributionStores } = await supabaseAdmin
    .from("campaign_attribution_stores")
    .select("store_id")
    .eq("attribution_id", attribution.id);
  const storeIds = (attributionStores || []).map((row) => row.store_id);
  if (storeIds.length === 0) return new Map();

  const { data: stores } = await supabaseAdmin
    .from("stores")
    .select("id, is_partner")
    .in("id", storeIds)
    .eq("is_partner", true);
  const eligibleStoreIds = (stores || []).map((s) => s.id);
  if (eligibleStoreIds.length === 0) return new Map();

  const { data: contracts } = await supabaseAdmin
    .from("partner_contracts")
    .select("id, store_id, rate_type, rate_value, created_at")
    .in("store_id", eligibleStoreIds)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  // First (most recent) contract per store wins, same "at most one live
  // accepted contract in practice" assumption the rest of this codebase
  // already makes.
  const contractByStoreId = new Map();
  (contracts || []).forEach((c) => {
    if (!contractByStoreId.has(c.store_id)) contractByStoreId.set(c.store_id, c);
  });

  const result = new Map();
  eligibleStoreIds.forEach((storeId) => {
    const contract = contractByStoreId.get(storeId);
    if (contract) result.set(storeId, { attribution, contract });
  });
  return result;
}
