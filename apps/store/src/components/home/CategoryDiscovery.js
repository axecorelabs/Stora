"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, ArrowUpRight } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import PrefetchLink from "@/components/ui/PrefetchLink";
import { APEX_DOMAIN } from "@/lib/apexDomain";
import { attachAutoScroll } from "@/lib/autoScroll";
import { AI_SEARCH_TEMPLATES, AI_SEARCH_TEMPLATES_MOBILE } from "@/lib/aiSearchTemplates";

// Food isn't just another /products?category= filter -- Biterave
// (biterave.<apex>) is Stora's own dedicated food-ordering experience,
// a separate subdomain with its own cart/checkout, restaurant menus, and
// grocery listings, not a subset of the general catalogue. Landing
// straight on /meals rather than Biterave's own marketing homepage
// mirrors what every other category tile does (go straight to a
// listing, not a teaser page). A plain <a target="_blank">, not
// PrefetchLink -- that wraps next/link and calls router.prefetch() on
// hover, which is for same-origin app routes; prefetching a different
// subdomain doesn't make sense, and "opens in a new tab" calls for a
// real anchor over client-side routing anyway.
const BITERAVE_URL = `https://biterave.${APEX_DOMAIN}/meals`;

// Which category gets the dark treatment -- purely a visual rhythm, not a
// ranking.
const DARK_CATEGORIES = new Set([
  "Clothing",
  "Perfumes",
  "Beverages",
  "Books",
  "Sports",
  "Wigs & Hair",
]);

// Desktop layout: a real CSS grid (not multi-column masonry), so every row
// resolves to the same height. One "big" tile spanning 2 rows, next to a
// 2-wide/1-wide/1-wide row and a 2-wide/2-wide row underneath -- six tiles
// that add up to exactly 5 cols x 2 rows per block (2+2+1+1+2+2=10),
// repeating every 6 categories.
//
// Explicit gridColumn/gridRow per tile (computed below in bentoStyle), not
// just span classes left to auto-placement -- the grid's own column
// TEMPLATE has to be wider than one block's 5 columns to fit every block
// side by side (see gridTemplateColumns further down), and once it's wider
// than that, the browser's auto-placement stops respecting each block's
// intended boundary: it just greedily packs left-to-right across the
// WHOLE wide row, which drifts tile 4 onward out of the block it's
// supposed to belong to (confirmed live -- "wide" tiles meant for a
// block's row 2 kept sliding into row 1 of the next block over instead).
// Pinning each tile to its own block's column range via an explicit
// column offset is what actually keeps every block self-contained.
const BENTO_POSITIONS = [
  { col: 1, colSpan: 1, row: 1, rowSpan: 2 }, // big
  { col: 2, colSpan: 2, row: 1, rowSpan: 1 }, // wide
  { col: 4, colSpan: 1, row: 1, rowSpan: 1 }, // small
  { col: 5, colSpan: 1, row: 1, rowSpan: 1 }, // small
  { col: 2, colSpan: 2, row: 2, rowSpan: 1 }, // wide
  { col: 4, colSpan: 2, row: 2, rowSpan: 1 }, // wide
];
const BENTO_COLS_PER_BLOCK = 5;

function bentoStyle(i, total) {
  const patternedCount = Math.floor(total / BENTO_POSITIONS.length) * BENTO_POSITIONS.length;

  if (i < patternedCount) {
    const blockOffset = Math.floor(i / BENTO_POSITIONS.length) * BENTO_COLS_PER_BLOCK;
    const { col, colSpan, row, rowSpan } = BENTO_POSITIONS[i % BENTO_POSITIONS.length];
    return {
      gridColumn: `${blockOffset + col} / span ${colSpan}`,
      gridRow: `${row} / span ${rowSpan}`
    };
  }

  // Whatever's left over after the last full block: a single leftover tile
  // gets the same tall "big" treatment as the very first tile in each
  // block, rather than a wide banner -- reads as a natural closing tile
  // instead of an oddly-stretched one-off. More than one leftover just
  // lines up left-to-right along the block's row 1, one column each --
  // still flush, since grid rows stay uniform either way.
  const blockOffset = Math.floor(patternedCount / BENTO_POSITIONS.length) * BENTO_COLS_PER_BLOCK;
  const remainder = total - patternedCount;
  if (remainder === 1) {
    return { gridColumn: `${blockOffset + 1} / span 1`, gridRow: "1 / span 2" };
  }
  return { gridColumn: `${blockOffset + 1 + (i - patternedCount)} / span 1`, gridRow: "1 / span 1" };
}

// How many category tiles show before mobile/tablet needs "See more" --
// desktop scrolls horizontally instead and has room for all of them, so
// this collapse only ever applies below the lg breakpoint.
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

  // 0.6px/frame (~36px/s) was too subtle to actually notice at a glance --
  // confirmed moving in an automated scrollLeft check, but reads as
  // stationary to an eye briefly looking at the page. 2 is a deliberately
  // visible drift, not just a technically-true one. The AI row runs a
  // touch slower (1.2) since its pills are narrower and pass by faster at
  // the same pixel speed.
  const categoryScrollRef = useRef(null);
  const categoryPausedRef = useRef(false);
  const categoryDirectionRef = useRef(1);
  useEffect(
    () => attachAutoScroll(categoryScrollRef, categoryPausedRef, categoryDirectionRef, 2),
    []
  );
  const pauseCategoryScroll = () => { categoryPausedRef.current = true; };
  const resumeCategoryScroll = () => { categoryPausedRef.current = false; };

  const aiScrollRef = useRef(null);
  const aiPausedRef = useRef(false);
  const aiDirectionRef = useRef(1);
  useEffect(
    () => attachAutoScroll(aiScrollRef, aiPausedRef, aiDirectionRef, 1.2),
    []
  );
  const pauseAiScroll = () => { aiPausedRef.current = true; };
  const resumeAiScroll = () => { aiPausedRef.current = false; };

  return (
    <div>
      {/* Mobile/tablet: plain 2/3-col wrapping grid + "See more", unchanged.
          Hidden at lg+ now that desktop gets its own horizontal shelf below. */}
      <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {CATEGORIES.map(({ value, icon: Icon }, i) => {
          const dark = DARK_CATEGORIES.has(value);
          const isFood = value === "Food";
          const collapsedOnMobile = i >= INITIAL_VISIBLE_COUNT && !expanded;
          const tileClassName = `${collapsedOnMobile ? "hidden" : "flex"} relative aspect-square flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 ${
            dark
              ? "bg-brand-800 border-brand-800 hover:bg-brand-900"
              : "bg-brand-50/60 border-brand-100 hover:border-brand-300 hover:bg-brand-50"
          }`;
          const tileContent = (
            <>
              {isFood && (
                <ArrowUpRight className={`w-4 h-4 absolute top-4 right-4 ${dark ? "text-white/40" : "text-brand-700/40"}`} />
              )}
              {Icon && <Icon className={`w-7 h-7 ${dark ? "text-gold-400" : "text-brand-700"}`} strokeWidth={1.75} />}
              <span className={`font-display text-lg font-semibold leading-tight ${dark ? "text-white" : "text-brand-900"}`}>
                {value}
              </span>
            </>
          );
          return isFood ? (
            <a key={value} href={BITERAVE_URL} target="_blank" rel="noopener noreferrer" className={tileClassName}>
              {tileContent}
            </a>
          ) : (
            <PrefetchLink
              key={value}
              href={`/products?category=${encodeURIComponent(value)}`}
              className={tileClassName}
            >
              {tileContent}
            </PrefetchLink>
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

      {/* Desktop: the same bento tile-size variety as before, just capped at
          2 rows and scrolling horizontally instead of wrapping into more
          row-pairs as categories are added. gridTemplateColumns has to be
          set inline, not as a Tailwind class -- its column count depends on
          CATEGORIES.length at runtime, and Tailwind's JIT can only pick up
          arbitrary values that are static, literal strings in source.
          w-screen + left-1/2 + -translate-x-1/2 breaks this out of the
          page's own max-w-7xl-centered container to bleed full viewport
          width, regardless of how much that ancestor's own padding
          constrains it -- the "Shop by category" heading above stays
          inside the normal container, only this shelf escapes it. */}
      <div
        ref={categoryScrollRef}
        onMouseEnter={pauseCategoryScroll}
        onMouseLeave={resumeCategoryScroll}
        onTouchStart={pauseCategoryScroll}
        onTouchEnd={resumeCategoryScroll}
        className="hidden lg:block w-screen relative left-1/2 -translate-x-1/2 overflow-x-auto pl-4 sm:pl-6 lg:pl-8 pr-4 sm:pr-6 lg:pr-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.ceil(CATEGORIES.length / BENTO_POSITIONS.length) * BENTO_COLS_PER_BLOCK}, 14rem)`,
            gridAutoRows: "13rem"
          }}
        >
          {CATEGORIES.map(({ value, icon: Icon }, i) => {
            const dark = DARK_CATEGORIES.has(value);
            const isFood = value === "Food";
            const tileStyle = bentoStyle(i, CATEGORIES.length);
            const tileClassName = `relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 ${
              dark
                ? "bg-brand-800 border-brand-800 hover:bg-brand-900"
                : "bg-brand-50/60 border-brand-100 hover:border-brand-300 hover:bg-brand-50"
            }`;
            const tileContent = (
              <>
                {isFood && (
                  <ArrowUpRight className={`w-4 h-4 absolute top-4 right-4 ${dark ? "text-white/40" : "text-brand-700/40"}`} />
                )}
                {Icon && <Icon className={`w-8 h-8 ${dark ? "text-gold-400" : "text-brand-700"}`} strokeWidth={1.75} />}
                <span className={`font-display text-xl font-semibold leading-tight ${dark ? "text-white" : "text-brand-900"}`}>
                  {value}
                </span>
              </>
            );
            return isFood ? (
              <a key={value} href={BITERAVE_URL} target="_blank" rel="noopener noreferrer" style={tileStyle} className={tileClassName}>
                {tileContent}
              </a>
            ) : (
              <PrefetchLink
                key={value}
                href={`/products?category=${encodeURIComponent(value)}`}
                style={tileStyle}
                className={tileClassName}
              >
                {tileContent}
              </PrefetchLink>
            );
          })}
        </div>
      </div>

      {/* AI search templates. Mobile/tablet: auto-scrolling row with the
          longer list -- same interaction as the category shelf above, own
          (slower) speed. Desktop: the original short list, wrapped in
          place with no animation, unchanged from before. */}
      <div className="mt-8">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Try asking Stora AI
        </p>

        <div
          ref={aiScrollRef}
          onMouseEnter={pauseAiScroll}
          onMouseLeave={resumeAiScroll}
          onTouchStart={pauseAiScroll}
          onTouchEnd={resumeAiScroll}
          className="lg:hidden flex gap-2 overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {AI_SEARCH_TEMPLATES_MOBILE.map((templateQuery) => (
            <PrefetchLink
              key={templateQuery}
              href={`/products?mode=ai&q=${encodeURIComponent(templateQuery)}`}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-brand-100 bg-white text-brand-800 hover:border-brand-300 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              {templateQuery}
            </PrefetchLink>
          ))}
        </div>

        <div className="hidden lg:flex gap-2 flex-wrap">
          {AI_SEARCH_TEMPLATES.map((templateQuery) => (
            <PrefetchLink
              key={templateQuery}
              href={`/products?mode=ai&q=${encodeURIComponent(templateQuery)}`}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-brand-100 bg-white text-brand-800 hover:border-brand-300 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              {templateQuery}
            </PrefetchLink>
          ))}
        </div>
      </div>
    </div>
  );
}
