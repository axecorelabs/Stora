"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

// Homepage teaser for active campaigns -- the "strategic place to link
// to campaigns" this page didn't have before. Renders nothing at all
// (not even the section) when there are no active campaigns, so an
// empty state never shows on the homepage.
export default function CampaignsShowcase() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/campaigns/active?limit=3");
        const data = await res.json();
        if (!cancelled && data.success) setCampaigns(data.campaigns || []);
      } catch (error) {
        console.error("Error loading active campaigns:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Renders nothing at all -- not even the surrounding section -- when
  // there are no active campaigns, so an empty band never shows on the
  // homepage. Owns its own <section> (rather than page.js wrapping one
  // unconditionally) specifically so this all-or-nothing rendering works.
  if (loading || campaigns.length === 0) return null;

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Discover</p>
          <h2 className="font-display text-2xl font-bold text-brand-900">Find your perfect match</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}`}
              className="group flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="aspect-[16/9] bg-brand-900">
                {campaign.bannerUrl && <img src={campaign.bannerUrl} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gold-600 mb-1.5">
                  <Sparkles className="w-3 h-3" />
                  Quiz
                </div>
                <p className="text-sm font-semibold text-gray-900">{campaign.title}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 mt-2 group-hover:gap-1.5 transition-all">
                  Take the quiz <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
