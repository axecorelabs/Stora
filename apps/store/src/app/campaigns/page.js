import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";

export const metadata = {
  title: "Quizzes & Recommendations - Stora",
  description: "Take a quiz and get personalized product recommendations from Stora's partner vendors."
};

// The "strategic place to link to campaigns" the site didn't have before
// -- every active campaign with at least one still-eligible member store,
// newest first.
export default async function CampaignsIndexPage() {
  const { data: campaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id, title, config, banner_url, created_at, campaign_stores(store_id, stores(is_partner, is_active))")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const activeCampaigns = (campaigns || []).filter((c) =>
    (c.campaign_stores || []).some((cs) => cs.stores?.is_partner && cs.stores?.is_active)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          Stora Quizzes
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 mb-8">
          Get personalized recommendations
        </h1>

        {activeCampaigns.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">No quizzes are running right now -- check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {activeCampaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="group flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="aspect-[16/9] bg-brand-900">
                  {campaign.banner_url && (
                    <img src={campaign.banner_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-5">
                  <p className="text-sm font-semibold text-gray-900">{campaign.title}</p>
                  {campaign.config?.resultsIntro && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{campaign.config.resultsIntro}</p>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 mt-3">
                    Take the quiz <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
