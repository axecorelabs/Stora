import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import CampaignQuizClient from "@/components/campaign/CampaignQuizClient";

// Top-level (not nested under [slug]) -- a campaign can pool several
// vendors now (campaign_stores), so it no longer belongs to one vendor's
// subdomain the way a single-vendor campaign used to. Confirmed safe:
// proxy.js's subdomain rewrite explicitly no-ops on the apex domain, so
// this behaves exactly like /discover or /search already do.
export async function generateMetadata({ params }) {
  const { campaignId } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select("title, config, banner_url")
    .eq("id", campaignId)
    .single();

  if (!campaign) return { title: "Campaign" };

  const title = `${campaign.title} - Stora`;
  const description = campaign.config?.resultsIntro || "Take our quiz and get personalized product recommendations.";
  const image = campaign.banner_url || "/og-image.jpg";

  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function CampaignPage({ params }) {
  const { campaignId } = await params;

  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, title, status, config, banner_url")
    .eq("id", campaignId)
    .single();

  if (error || !campaign || campaign.status !== "active") {
    notFound();
  }

  // At least one still-eligible (partner + active) member store, or
  // there's nothing to recommend from -- same defensive check the
  // /complete route applies before scoring.
  const { data: memberRows } = await supabaseAdmin
    .from("campaign_stores")
    .select("store_id")
    .eq("campaign_id", campaign.id);
  const memberStoreIds = (memberRows || []).map((r) => r.store_id);

  const { data: stores } = memberStoreIds.length
    ? await supabaseAdmin.from("stores").select("id").in("id", memberStoreIds).eq("is_partner", true).eq("is_active", true)
    : { data: [] };

  if (!stores || stores.length === 0) {
    notFound();
  }

  const campaignData = JSON.parse(JSON.stringify(campaign));

  return <CampaignQuizClient campaign={campaignData} bannerUrl={campaign.banner_url} />;
}
