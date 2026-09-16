"use client";
import { useRouter } from "next/navigation";
import { Compass, Wrench, ChevronRight } from "lucide-react";
import AISearchInput from "@/components/search/AISearchInput";
import PrefetchLink from "@/components/ui/PrefetchLink";

// AISearchInput itself has no submit/navigation behavior -- onChange fires
// only once a query is actually committed (Enter or the arrow button), so
// this is the one place that turns that into a real search: same
// mode=ai + q URL shape CategoryDiscovery.js's own AI template pills
// already use, which /products reads on load to auto-run the AI search
// with zero extra wiring on that end.
function submitAiQuery(router, query) {
  router.push(`/products?mode=ai&q=${encodeURIComponent(query)}`);
}

// Replaces the plain HeroSearch keyword box on the homepage hero -- the
// question this whole box is really asking is "what are you looking for
// today?", so that's the AI input's own placeholder rather than a generic
// one. "Just browsing" and "Need a service?" cover the two people who'd
// rather not type a sentence: one wants the same /products catalog
// HeroSearch always defaulted to with no filter, the other wants
// /vendors' own scope=services toggle (see the search-consolidation
// work) rather than a product search that could never have surfaced a
// service provider anyway.
//
// Hero text is tuned for a dark-green backdrop on the homepage.
export default function AIHeroSearch() {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto text-center w-full">
      <h1 className="font-display text-2xl sm:text-5xl font-bold text-white leading-tight mb-8 sm:mb-10">
        What are you looking for today?{" "}
        <span className="text-xl sm:text-4xl align-middle">😊</span>
        <br />
        <span className="text-gold-400">Let&apos;s help you find it.</span>
      </h1>

      {/* Gradient border, not a plain one -- this box is the one thing on
          the page every visitor should notice first, so it gets the
          brand's own gold-to-green treatment as a focal point instead of
          blending in with the flat-bordered pills around it. */}
      <div
        className="rounded-2xl p-[1.5px] mb-6"
        style={{
          background: "linear-gradient(115deg, #D8BC85 0%, rgba(216,188,133,0) 35%, rgba(20,92,65,0) 65%, #145C41 100%)"
        }}
      >
        <div className="flex items-start bg-white px-6 py-5 sm:py-6 rounded-2xl shadow-[0_1px_2px_rgba(11,59,46,0.04),0_20px_48px_-16px_rgba(11,59,46,0.2)]">
          <AISearchInput
            value=""
            onChange={(query) => submitAiQuery(router, query)}
            placeholder="What are you looking for today?"
            textClassName="text-xs sm:text-sm"
            minHeightClassName="min-h-[3.75rem] sm:min-h-[2.5rem]"
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mb-10">
        <PrefetchLink
          href="/products"
          className="inline-flex items-center gap-1.5 pl-4 pr-3 py-2 rounded-full text-xs sm:text-sm font-medium bg-white/95 text-brand-900 hover:bg-white transition-colors"
        >
          <Compass className="w-3.5 h-3.5 text-brand-700" />
          Just browsing
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        </PrefetchLink>
        <PrefetchLink
          href="/vendors?scope=services"
          className="inline-flex items-center gap-1.5 pl-4 pr-3 py-2 rounded-full text-xs sm:text-sm font-medium bg-white/95 text-brand-900 hover:bg-white transition-colors"
        >
          <Wrench className="w-3.5 h-3.5 text-brand-700" />
          Need a service?
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        </PrefetchLink>
      </div>
    </div>
  );
}
