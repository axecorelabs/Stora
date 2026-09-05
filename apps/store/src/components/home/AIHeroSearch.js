"use client";
import { useRouter } from "next/navigation";
import { Compass, Wrench } from "lucide-react";
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
// Deliberately just headline + subtitle + search + two quick options,
// nothing more -- this used to also carry a "Popular searches" label and
// a whole auto-scrolling AI-template pill row, which was genuinely
// redundant (CategoryDiscovery.js's own "Try asking Stora AI" row a
// short scroll away is the exact same list) and made this the heaviest,
// busiest part of the page before anyone had even started browsing.
// Light hero (white background, dark text) rather than the dark-hero
// treatment this used to have -- the dark green now belongs to the trust
// badges band page.js renders right below this, with the wave transition
// between them, so the hero itself reads as a clean, uncluttered "first
// screen" instead of one long dark block.
export default function AIHeroSearch() {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto text-center w-full">
      <h1 className="font-display text-3xl sm:text-5xl font-bold text-gray-900 leading-tight mb-5">
        Real vendors.
        <br className="sm:hidden" />
        {" "}Real products.
        <br />
        <span className="text-brand-600">One place to find them.</span>
      </h1>
      <p className="text-gray-500 text-base sm:text-lg mb-8 max-w-xl mx-auto">
        Tell Stora AI what you need, in your own words — we&apos;ll match you with the
        right vendor.
      </p>

      <div className="flex items-start bg-white px-6 py-3.5 rounded-2xl border border-gray-200 shadow-sm mb-5">
        <AISearchInput
          value=""
          onChange={(query) => submitAiQuery(router, query)}
          placeholder="What are you looking for today?"
        />
      </div>

      <div className="flex items-center justify-center gap-3">
        <PrefetchLink
          href="/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-brand-900 hover:bg-gray-200 transition-colors"
        >
          <Compass className="w-3.5 h-3.5 text-brand-700" />
          Just browsing
        </PrefetchLink>
        <PrefetchLink
          href="/vendors?scope=services"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-brand-900 hover:bg-gray-200 transition-colors"
        >
          <Wrench className="w-3.5 h-3.5 text-brand-700" />
          Need a service?
        </PrefetchLink>
      </div>
    </div>
  );
}
