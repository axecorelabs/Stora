"use client";
import { useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Compass, Wrench, Sparkles } from "lucide-react";
import AISearchInput from "@/components/search/AISearchInput";
import PrefetchLink from "@/components/ui/PrefetchLink";
import { attachAutoScroll } from "@/lib/autoScroll";
import { AI_SEARCH_TEMPLATES, AI_SEARCH_TEMPLATES_MOBILE } from "@/lib/aiSearchTemplates";

// AISearchInput itself has no submit/navigation behavior -- onChange fires
// only once a query is actually committed (Enter or the arrow button), so
// this is the one place that turns that into a real search: same
// mode=ai + q URL shape CategoryDiscovery.js's own AI template pills
// already use, which /products reads on load to auto-run the AI search
// with zero extra wiring on that end.
function submitAiQuery(router, query) {
  router.push(`/products?mode=ai&q=${encodeURIComponent(query)}`);
}

// The hero's own AI-template row -- same underlying list and auto-scroll
// mechanism as CategoryDiscovery.js's "Try asking Stora AI" row further
// down the page, just recolored for a dark hero instead of a white
// section. Having it twice isn't accidental duplication: the hero is a
// first impression before anyone's scrolled, the later row is a second
// nudge once they're already browsing categories.
function TemplateRow() {
  const scrollRef = useRef(null);
  const pausedRef = useRef(false);
  const directionRef = useRef(1);
  useEffect(() => attachAutoScroll(scrollRef, pausedRef, directionRef, 1.2), []);
  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  const pillClassName =
    "flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-white/15 bg-white/10 text-white backdrop-blur-sm hover:bg-white/15 hover:border-white/25 transition-colors";

  return (
    <>
      {/* Mobile/tablet: auto-scrolling, longer list -- mirrors
          CategoryDiscovery.js's own lg:hidden AI row exactly. */}
      <div
        ref={scrollRef}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        className="lg:hidden flex gap-2 overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {AI_SEARCH_TEMPLATES_MOBILE.map((templateQuery) => (
          <PrefetchLink
            key={templateQuery}
            href={`/products?mode=ai&q=${encodeURIComponent(templateQuery)}`}
            className={pillClassName}
          >
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            {templateQuery}
          </PrefetchLink>
        ))}
      </div>

      {/* Desktop: short list, wrapped in place, no animation. */}
      <div className="hidden lg:flex flex-wrap justify-center gap-2">
        {AI_SEARCH_TEMPLATES.map((templateQuery) => (
          <PrefetchLink
            key={templateQuery}
            href={`/products?mode=ai&q=${encodeURIComponent(templateQuery)}`}
            className={pillClassName}
          >
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            {templateQuery}
          </PrefetchLink>
        ))}
      </div>
    </>
  );
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
export default function AIHeroSearch() {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto text-center w-full">
      <h1 className="font-display text-3xl sm:text-5xl font-bold text-white leading-tight mb-5">
        Real vendors. Real products.
        <br />
        One place to find them.
      </h1>
      <p className="text-white/60 text-base sm:text-lg mb-8 max-w-xl mx-auto">
        Just tell Stora AI what you need, in your own words -- we&apos;ll match you with the
        right vendor.
      </p>

      <div
        className="rounded-2xl p-[1.5px] mb-5"
        style={{
          background: "linear-gradient(115deg, #D8BC85 0%, rgba(216,188,133,0) 35%, rgba(20,92,65,0) 65%, #145C41 100%)"
        }}
      >
        <div className="flex items-start bg-white px-6 py-3.5 rounded-2xl shadow-[0_1px_2px_rgba(11,59,46,0.04),0_20px_48px_-16px_rgba(11,59,46,0.2)]">
          <AISearchInput
            value=""
            onChange={(query) => submitAiQuery(router, query)}
            placeholder="What are you looking for today?"
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mb-8">
        <PrefetchLink
          href="/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors"
        >
          <Compass className="w-3.5 h-3.5" />
          Just browsing
        </PrefetchLink>
        <PrefetchLink
          href="/vendors?scope=services"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors"
        >
          <Wrench className="w-3.5 h-3.5" />
          Need a service?
        </PrefetchLink>
      </div>

      <TemplateRow />
    </div>
  );
}
