"use client";
import SearchTypeahead from "./SearchTypeahead";
import { CATEGORIES } from "@/lib/categories";

/**
 * One hero search capsule -- the clear focal point, ringed in a hairline
 * gold-to-green gradient found nowhere else in the app -- with category as
 * pills underneath so every option is visible at a glance rather than
 * hidden behind a dropdown. Price and sort live in their own row above the
 * results grid, at opposite corners -- they're per-grid display controls,
 * not query refinements, so they stay closer to what they affect.
 */
export default function SearchConsole({
  query, onQueryChange, searchPlaceholder,
  category, onCategoryChange,
  resultCount, loading, resultLabel = "results",
}) {
  return (
    <div className="max-w-3xl mx-auto mb-6">
      <div
        className="rounded-full p-[1.5px]"
        style={{
          background:
            "linear-gradient(115deg, #D8BC85 0%, rgba(216,188,133,0) 35%, rgba(20,92,65,0) 65%, #145C41 100%)",
        }}
      >
        <div className="flex items-center bg-white rounded-full px-6 py-3.5 shadow-[0_1px_2px_rgba(11,59,46,0.04),0_20px_48px_-16px_rgba(11,59,46,0.2)]">
          <SearchTypeahead variant="embedded" value={query} onChange={onQueryChange} placeholder={searchPlaceholder} />
        </div>
      </div>

      {/* Category as pills, not a dropdown -- there are ~9 of them, and
          seeing every option at a glance beats digging through a hidden
          list. Wraps to a second centered line rather than scrolling, so
          nothing stays off-screen. */}
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        <button
          onClick={() => onCategoryChange("")}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
            !category
              ? "bg-brand-700 text-white border-brand-700"
              : "bg-white text-brand-800 border-brand-100 hover:border-brand-300"
          }`}
        >
          All categories
        </button>
        {CATEGORIES.map(({ value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onCategoryChange(category === value ? "" : value)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              category === value
                ? "bg-brand-700 text-white border-brand-700"
                : "bg-white text-brand-800 border-brand-100 hover:border-brand-300"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {value}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 mt-3 font-mono tabular-nums">
        {loading ? "Searching…" : `${(resultCount ?? 0).toLocaleString()} ${resultLabel}`}
      </p>
    </div>
  );
}
