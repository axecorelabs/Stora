"use client";
import { Sparkles } from "lucide-react";
import SearchTypeahead from "./SearchTypeahead";
import AISearchInput from "./AISearchInput";
import StateFilterToken from "./StateFilterToken";
import { CATEGORIES } from "@/lib/categories";

/**
 * One hero search capsule -- the clear focal point, ringed in a hairline
 * gold-to-green gradient found nowhere else in the app -- with category as
 * pills underneath so every option is visible at a glance rather than
 * hidden behind a dropdown. Price and sort live in their own row above the
 * results grid, at opposite corners -- they're per-grid display controls,
 * not query refinements, so they stay closer to what they affect.
 *
 * Category and state are desktop-only here (`hidden sm:block`) -- below
 * `sm`, MobileFilterBar's two-button-plus-sheet pattern owns them instead.
 * Stacking every control inline (as this component still does above `sm`)
 * measured as ~480px of chrome before the first result on a 390px phone,
 * with price and sort actually overlapping/overflowing the viewport --
 * the sheet pattern both fixes that and gives category/state genuine room
 * to breathe (a wrapped grid, a searchable list) instead of a cramped
 * horizontal scroll.
 */
export default function SearchConsole({
  query, onQueryChange, searchPlaceholder,
  categories, onCategoriesChange,
  state, onStateChange,
  resultCount, loading, resultLabel = "results",
  aiMode, onAiModeChange,
}) {
  const toggleCategory = (value) => {
    onCategoriesChange(
      categories.includes(value) ? categories.filter((c) => c !== value) : [...categories, value]
    );
  };
  return (
    <div className="max-w-3xl mx-auto mb-6">
      {/* Off by default -- nobody's existing search experience changes
          unless they opt in. Same sparkle icon as AISearchInput's own
          icon once toggled on, so the visual language stays consistent
          between "here's the switch" and "you're in this mode now". Sits
          above the search bar, right-aligned -- a settings-style toggle
          for the input below it, not a result of the search itself. */}
      {onAiModeChange && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => onAiModeChange(!aiMode)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              aiMode
                ? "bg-brand-700 text-white border-brand-700"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Search
          </button>
        </div>
      )}

      <div
        // Less rounded in AI mode -- a full pill reads as a single-line
        // search field; a squarer corner matches the multi-line, chat-style
        // input people already recognize from other AI products.
        className={`${aiMode ? "rounded-2xl" : "rounded-full"} p-[1.5px]`}
        style={{
          background:
            "linear-gradient(115deg, #D8BC85 0%, rgba(216,188,133,0) 35%, rgba(20,92,65,0) 65%, #145C41 100%)",
        }}
      >
        <div className={`flex items-start bg-white px-6 py-3.5 shadow-[0_1px_2px_rgba(11,59,46,0.04),0_20px_48px_-16px_rgba(11,59,46,0.2)] ${aiMode ? "rounded-2xl" : "rounded-full"}`}>
          {aiMode ? (
            <AISearchInput value={query} onChange={onQueryChange} />
          ) : (
            <div className="flex items-center w-full">
              <SearchTypeahead variant="embedded" value={query} onChange={onQueryChange} placeholder={searchPlaceholder} />
            </div>
          )}
        </div>
      </div>

      {/* Category pills are a keyword-mode concept -- AI mode extracts its
          own category signal straight out of the sentence itself, so a
          manual pill row would just be a second, conflicting way to say
          the same thing. The state filter (vendor location) stays visible
          in both modes though -- it's independent of the AI's ranking,
          same as "Deliverable to me" is. */}
      {!aiMode && (
        <>
          {/* Category as pills, not a dropdown -- there are ~9 of them, and
              seeing every option at a glance beats digging through a hidden
              list. Multi-select: each pill toggles its own membership in
              `categories` independently, so browsing "Clothing and Shoes" at
              once is one tap each rather than an either/or choice. Wraps to a
              second centered line rather than scrolling, so nothing stays
              off-screen. Desktop-only -- see the component comment above for
              the mobile equivalent. */}
          <div className="hidden sm:flex sm:flex-wrap sm:justify-center gap-2 mt-4">
            <button
              onClick={() => onCategoriesChange([])}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${
                categories.length === 0
                  ? "bg-brand-700 text-white border-brand-700"
                  : "bg-white text-brand-800 border-brand-100 hover:border-brand-300"
              }`}
            >
              All categories
            </button>
            {CATEGORIES.map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => toggleCategory(value)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${
                  categories.includes(value)
                    ? "bg-brand-700 text-white border-brand-700"
                    : "bg-white text-brand-800 border-brand-100 hover:border-brand-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {value}
              </button>
            ))}
          </div>
        </>
      )}

      {onStateChange && (
        <div className="hidden sm:flex justify-center mt-3">
          <StateFilterToken value={state} onChange={onStateChange} />
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-3 font-mono tabular-nums">
        {loading ? "Searching…" : `${(resultCount ?? 0).toLocaleString()} ${aiMode ? "AI matches" : resultLabel}`}
      </p>
    </div>
  );
}
