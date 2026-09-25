"use client";
import { useEffect, useState } from "react";
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
// "need"/"looking for" were dropped from this pattern -- they're far too
// generic (they match "I need books on finance" just as readily as "I
// need a plumber") to be a useful business-intent signal, and this is
// only ever a same-tab first guess anyway: the real classification runs
// server-side in api/search/ai/route.js's shouldRouteToVendors, and both
// /products and /vendors self-correct via the `resolvedPrimary` it
// returns if this guess is wrong. Keeping the more specific terms here is
// still worth it purely to skip that redirect round-trip in the common case.
function inferAiDestination(query) {
  const normalized = (query || "").toLowerCase();
  const businessIntentPattern = /\b(hire|book|find\s+me|vendor|business|service|photograph|photographer|tailor|plumber|electrician|makeup|stylist|repair|cleaning|barber|decorator)\b/;
  return businessIntentPattern.test(normalized) ? "vendors" : "products";
}

function submitAiQuery(router, query, intentMode) {
  if (intentMode === "products") {
    router.push(`/products?mode=ai&q=${encodeURIComponent(query)}`);
    return;
  }

  if (intentMode === "businesses") {
    router.push(`/vendors?mode=ai&q=${encodeURIComponent(query)}`);
    return;
  }

  const destination = inferAiDestination(query);
  const basePath = destination === "vendors" ? "/vendors" : "/products";
  router.push(`${basePath}?mode=ai&q=${encodeURIComponent(query)}`);
}

const AI_PLACEHOLDER_EXAMPLES = [
  "Find a birthday gift under ₦20k in Osogbo",
  "Need a makeup artist for Saturday",
  "Where can I buy running shoes near me?",
  "Show me food vendors open right now",
];

// Replaces the plain HeroSearch keyword box on the homepage hero -- the
// question this whole box is really asking is "what are you looking for
// today?", so that's the AI input's own placeholder rather than a generic
// one. "Just browsing" and "Looking for a business?" cover the two people
// who'd rather not type a sentence: one wants the same /products catalog
// HeroSearch always defaulted to with no filter, the other wants the full,
// unscoped /vendors listing rather than a product search that could never
// have surfaced a business anyway. Deliberately unscoped (not
// ?scope=services) -- the label promises businesses in general, not
// specifically service providers, and scoping it silently filtered out
// every retail/restaurant vendor.
//
// Hero text is tuned for a dark-green backdrop on the homepage.
export default function AIHeroSearch() {
  const router = useRouter();
  const [intentMode, setIntentMode] = useState("auto");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Starts false and flips on the next frame (not the same one) so the
  // browser actually paints the "hidden" state first -- setting it true
  // synchronously on mount would let React batch both states into one
  // paint, skipping the transition entirely.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % AI_PLACEHOLDER_EXAMPLES.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, []);

  const placeholder = AI_PLACEHOLDER_EXAMPLES[placeholderIndex] || "What are you looking for today?";

  const handleSubmit = (query) => {
    setIsSubmitting(true);
    submitAiQuery(router, query, intentMode);
  };

  return (
    <div className="max-w-3xl mx-auto text-center w-full">
      <h1
        className={`font-display text-2xl sm:text-5xl font-bold text-white leading-tight mb-8 sm:mb-10 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
          mounted ? "opacity-100 translate-y-0" : "reveal-hidden opacity-0 translate-y-4"
        }`}
      >
        What are you looking for today?{" "}
        <span className="text-xl sm:text-4xl align-middle">😊</span>
        <br />
        <span className="text-gold-400">Let&apos;s help you find it.</span>
      </h1>

      {/* Gradient border, not a plain one -- this box is the one thing on
          the page every visitor should notice first, so it gets the
          brand's own gold-to-green treatment as a focal point instead of
          blending in with the flat-bordered pills around it. Entrance is
          staggered ~120ms after the headline (delay-150) -- one small,
          orchestrated beat rather than everything landing at once. */}
      <div
        className={`rounded-2xl p-[1.5px] mb-6 transition-[opacity,transform] duration-700 delay-150 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
          mounted ? "opacity-100 translate-y-0" : "reveal-hidden opacity-0 translate-y-4"
        }`}
        style={{
          background: "linear-gradient(115deg, #D8BC85 0%, rgba(216,188,133,0) 35%, rgba(20,92,65,0) 65%, #145C41 100%)"
        }}
      >
        <div className="flex flex-col items-stretch gap-3 bg-white/78 backdrop-blur-[1.5px] px-4 sm:px-6 py-4 sm:py-6 rounded-2xl border border-dashed border-brand-300/90 shadow-[0_1px_2px_rgba(11,59,46,0.04),0_20px_48px_-16px_rgba(11,59,46,0.2)] transition-shadow duration-200 focus-within:shadow-[0_2px_6px_rgba(11,59,46,0.12),0_24px_56px_-16px_rgba(11,59,46,0.26)] focus-within:ring-2 focus-within:ring-gold-400/70">
          <div className="inline-flex self-start rounded-full bg-brand-50 p-1">
            <button
              type="button"
              onClick={() => setIntentMode("auto")}
              className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-colors ${
                intentMode === "auto" ? "bg-white text-brand-900 shadow-sm" : "text-brand-700 hover:text-brand-900"
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => setIntentMode("products")}
              className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-colors ${
                intentMode === "products" ? "bg-white text-brand-900 shadow-sm" : "text-brand-700 hover:text-brand-900"
              }`}
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => setIntentMode("businesses")}
              className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-colors ${
                intentMode === "businesses" ? "bg-white text-brand-900 shadow-sm" : "text-brand-700 hover:text-brand-900"
              }`}
            >
              Businesses
            </button>
          </div>

          <div className="flex items-start px-1 sm:px-2 py-1">
          <AISearchInput
            value=""
            onChange={handleSubmit}
            placeholder={placeholder}
            textClassName="text-xs sm:text-sm"
            minHeightClassName="min-h-[3.75rem] sm:min-h-[2.5rem]"
            submitting={isSubmitting}
            disabled={isSubmitting}
          />
          </div>

          <p className="hidden sm:block text-left text-xs text-brand-700/70 px-1">
            Press Enter to search or tap Ask AI
          </p>
        </div>
      </div>

      {/* "Just browsing" / "Looking for a business?" pills -- commented out
          for now, not deleted. Re-enable by uncommenting.
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
          href="/vendors"
          className="inline-flex items-center gap-1.5 pl-4 pr-3 py-2 rounded-full text-xs sm:text-sm font-medium bg-white/95 text-brand-900 hover:bg-white transition-colors"
        >
          <Wrench className="w-3.5 h-3.5 text-brand-700" />
          Looking for a business?
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        </PrefetchLink>
      </div>
      */}
    </div>
  );
}
