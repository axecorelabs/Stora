import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Public, no auth -- powers the homepage's campaigns teaser
// (components/home/CampaignsShowcase.js) and the /campaigns listing
// page. Only campaigns with at least one still-eligible (partner +
// active) member store are surfaced.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit")) || 10, 20);

  const { data: campaigns, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, title, config, banner_url, created_at, campaign_stores(store_id, stores(is_partner, is_active))")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error loading active campaigns:", error);
    return NextResponse.json({ success: false, message: "Failed to load campaigns" }, { status: 500 });
  }

  const active = (campaigns || [])
    .filter((c) => (c.campaign_stores || []).some((cs) => cs.stores?.is_partner && cs.stores?.is_active))
    .map((c) => ({
      id: c.id,
      title: c.title,
      resultsIntro: c.config?.resultsIntro || null,
      bannerUrl: c.banner_url
    }));

  return NextResponse.json({ success: true, campaigns: active });
}
