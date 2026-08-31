"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

// Natural-language prompts, same tone as AISearchInput's own placeholder
// examples -- tapping one lands straight on /products with AI mode already
// on and the query already submitted (mode=ai + q is exactly what
// products/page.js reads to do that on load, see urlAiMode/urlQ there).
const AI_SEARCH_TEMPLATES = [
  "Ankara styles for a wedding",
  "A gift under ₦20k",
  "Skincare for oily skin",
  "Vendors that deliver same day",
  "Native wears for men",
  "Home office setup",
];

// Which category gets the dark treatment -- purely a visual rhythm, not a
// ranking. Hand-picked rather than cycled by index so it can't land in
// lockstep with the bento span pattern below.
const DARK_CATEGORIES = new Set([
  "Clothing",
  "Perfumes",
  "Beverages",
  "Books",
  "Sports",
  "Wigs & Hair",
]);

// Desktop layout: a real CSS grid (not multi-column masonry), so every row
// resolves to the same height and the grid's outer edges stay flush --
// masonry columns pack independently and end at different heights.
// One "big" tile spanning 2 rows, next to a 2-wide/1-wide/1-wide row and a
// 2-wide/2-wide row underneath -- six spans that add up to exactly
// 5 cols x 2 rows (2+2+1+1+2+2=10), so the browser's own left-to-right,
// top-to-bottom auto-placement tiles it with zero gaps, no explicit
// grid-column/row positioning needed. Repeats every 6 categories.
const BENTO_BLOCK = [
  "lg:col-span-1 lg:row-span-2", // big
  "lg:col-span-2 lg:row-span-1", // wide
  "lg:col-span-1 lg:row-span-1", // small
  "lg:col-span-1 lg:row-span-1", // small
  "lg:col-span-2 lg:row-span-1", // wide
  "lg:col-span-2 lg:row-span-1", // wide
];

function bentoSpanClass(i, total) {
  const patternedCount = Math.floor(total / BENTO_BLOCK.length) * BENTO_BLOCK.length;
  if (i < patternedCount) return BENTO_BLOCK[i % BENTO_BLOCK.length];
  // Whatever's left over after the last full block: a single leftover tile
  // closes the grid out as a full-width banner; more than one just falls
  // back to plain 1x1 cells -- still flush, since grid rows stay uniform
  // either way.
  const remainder = total - patternedCount;
  return remainder === 1 ? "lg:col-span-5 lg:row-span-1" : "lg:col-span-1 lg:row-span-1";
}

// How many category tiles show before mobile/tablet needs "See more" --
// desktop's bento grid has room for all of them, so the collapse only
// applies below the lg breakpoint (see the hidden/lg:flex split below).
const INITIAL_VISIBLE_COUNT = 6;

// Sits between the vendor showcase and the product discovery teaser on the
// homepage. Two separate ways in: a category tile filters /products by
// category (same URL param DiscoverySection's own pills already use), an
// AI template hands a ready-made natural-language query straight to AI
// search mode. The category pills inside DiscoverySection stay -- this
// isn't a replacement for them, just an earlier, more visual entry point.
export default function CategoryDiscovery() {
  const [expanded, setExpanded] = useState(false);
  const hasMore = CATEGORIES.length > INITIAL_VISIBLE_COUNT;

  return (
    <div>
      {/* Category grid: plain 2/3-col grid + "See more" below lg, bento grid at lg+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:auto-rows-[10rem]">
        {CATEGORIES.map(({ value, icon: Icon }, i) => {
          const dark = DARK_CATEGORIES.has(value);
          const collapsedOnMobile = i >= INITIAL_VISIBLE_COUNT && !expanded;
          return (
            <Link
              key={value}
              href={`/products?category=${encodeURIComponent(value)}`}
              className={`${collapsedOnMobile ? "hidden lg:flex" : "flex"} ${bentoSpanClass(i, CATEGORIES.length)} aspect-square lg:aspect-auto flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 ${
                dark
                  ? "bg-brand-800 border-brand-800 hover:bg-brand-900"
                  : "bg-brand-50/60 border-brand-100 hover:border-brand-300 hover:bg-brand-50"
              }`}
            >
              {Icon && <Icon className={`w-7 h-7 ${dark ? "text-gold-400" : "text-brand-700"}`} strokeWidth={1.75} />}
              <span className={`font-display text-lg font-semibold leading-tight ${dark ? "text-white" : "text-brand-900"}`}>
                {value}
              </span>
            </Link>
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center lg:hidden">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
          >
            {expanded ? "See less" : "See more"}
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* AI search templates -- horizontal scroll on mobile, wraps on desktop,
          same interaction pattern as DiscoverySection's own category pills. */}
      <div className="mt-8">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Try asking Stora AI
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {AI_SEARCH_TEMPLATES.map((templateQuery) => (
            <Link
              key={templateQuery}
              href={`/products?mode=ai&q=${encodeURIComponent(templateQuery)}`}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-brand-100 bg-white text-brand-800 hover:border-brand-300 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              {templateQuery}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
