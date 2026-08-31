"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
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

// Purely a visual rhythm for the masonry -- which category gets a taller
// tile or the dark treatment, not a ranking. Hand-assigned per category
// (rather than cycled by index) on purpose: a short repeating cycle lines
// up with the column count at some breakpoint -- e.g. a 4-item cycle
// against columns-4 puts the same style at the top of every column --
// since CSS multi-column layout balances items into columns rather than
// placing them in simple left-to-right order.
const TILE_STYLE_BY_CATEGORY = {
  Clothing: { aspect: "aspect-[4/5]", dark: true },
  Shoes: { aspect: "aspect-square", dark: false },
  Accessories: { aspect: "aspect-[4/5]", dark: false },
  Perfumes: { aspect: "aspect-square", dark: true },
  Food: { aspect: "aspect-[4/5]", dark: false },
  Beverages: { aspect: "aspect-square", dark: true },
  Electronics: { aspect: "aspect-square", dark: false },
  Books: { aspect: "aspect-[4/5]", dark: true },
  "Home & Garden": { aspect: "aspect-square", dark: false },
  Sports: { aspect: "aspect-[4/5]", dark: true },
  Automotive: { aspect: "aspect-square", dark: false },
  "Health & Beauty": { aspect: "aspect-[4/5]", dark: false },
  "Wigs & Hair": { aspect: "aspect-square", dark: true },
};
const DEFAULT_TILE_STYLE = { aspect: "aspect-square", dark: false };

// Sits between the vendor showcase and the product discovery teaser on the
// homepage. Two separate ways in: a category tile filters /products by
// category (same URL param DiscoverySection's own pills already use), an
// AI template hands a ready-made natural-language query straight to AI
// search mode. The category pills inside DiscoverySection stay -- this
// isn't a replacement for them, just an earlier, more visual entry point.
export default function CategoryDiscovery() {
  return (
    <div>
      {/* Category masonry grid */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4">
        {CATEGORIES.map(({ value, icon: Icon }) => {
          const { aspect, dark } = TILE_STYLE_BY_CATEGORY[value] || DEFAULT_TILE_STYLE;
          return (
            <Link
              key={value}
              href={`/products?category=${encodeURIComponent(value)}`}
              className={`mb-3 sm:mb-4 flex break-inside-avoid flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 ${aspect} ${
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
