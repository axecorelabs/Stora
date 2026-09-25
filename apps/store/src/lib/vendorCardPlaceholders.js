import { ShoppingBag, UtensilsCrossed, Briefcase, LayoutGrid, Store } from "lucide-react";

// A business without its own logo gets an icon matching its category
// instead of a bare initial letter -- more identifiable at a glance across
// a grid of otherwise-identical placeholder cards. Keyed to
// BUSINESS_CATEGORY_VALUES (@stora/shared-constants) -- 'other'/unset
// falls back to the plain Store icon already used as this card's generic
// "Store" profile-type badge, so an unrecognized category never looks
// broken.
// Exported as a plain map (not wrapped in a function) so callers do a
// direct `CATEGORY_ICONS[x] || Store` lookup at the JSX call site --
// matching this codebase's existing ternary/property-lookup convention
// for a dynamic icon component (see profileTag.Icon in this same file's
// callers), which the static-components lint rule accepts; a helper
// function returning a component reference does not.
export const CATEGORY_ICONS = {
  retail: ShoppingBag,
  restaurant: UtensilsCrossed,
  services: Briefcase,
  hybrid: LayoutGrid
};

export const DEFAULT_VENDOR_ICON = Store;

// Rotated per-business so a grid of unbranded cards doesn't read as one
// flat wall of the same fallback color. Deterministic (hashed from the
// store's own id, not random) so a given business keeps the same color
// across renders/pages rather than flickering between reloads. Distinct
// from Stora's own reserved brand-*/gold-* tokens (those are platform
// chrome elsewhere) and from any one vendor's real primaryColor -- this
// palette exists purely as a tasteful placeholder set.
const FALLBACK_PALETTE = ["#0F766E", "#B45309", "#7C3AED", "#BE123C", "#0369A1", "#4D7C0F"];

export function getVendorFallbackColor(storeId) {
  const id = storeId || "";
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

// Same photo library CategoryDiscovery.js already uses for the homepage's
// "Shop by category" tiles (apps/store/public/*.webp) -- reused here so an
// unbranded business's banner varies by what it actually is instead of
// every business with no photo of its own showing the exact same one
// image. Bucketed by the coarse business_category (the one field every
// seeded business reliably has), with `restaurant` mapped to the one
// unambiguous match and everything else split across the general-retail
// set for variety.
const RESTAURANT_BANNERS = ["/food.webp"];
const SERVICES_BANNERS = ["/Healthandbeauty.webp", "/Automotive.webp"];
const RETAIL_BANNERS = [
  "/Accessories.webp", "/Clothing.webp", "/Electronics.webp", "/Shoes.webp",
  "/Wigsandhair.webp", "/HomeandGarden.webp", "/Beverages.webp", "/Books.webp",
  "/perfumes.webp", "/Sports.webp"
];
const CATEGORY_BANNERS = {
  restaurant: RESTAURANT_BANNERS,
  services: SERVICES_BANNERS,
  retail: RETAIL_BANNERS,
  hybrid: RETAIL_BANNERS,
  other: RETAIL_BANNERS
};

// These source photos share one template (confirmed by opening several):
// cream background, the product centered roughly 15%-75% down the frame,
// and a text caption sitting on plain background in the bottom ~15%. A
// vendor banner is a much wider/shorter box than CategoryDiscovery's own
// near-square tiles -- object-fit:cover already crops these portrait-ish
// images down to a thin ~30% vertical slice before any extra zoom even
// applies, so anchoring that slice with object-position is what actually
// matters here (CategoryDiscovery's own tile-crop numbers, tuned for a
// much less extreme aspect ratio, don't transfer -- reusing them was the
// bug: "center top" picked a slice that was almost entirely empty
// background, showing only the very top edge of the product). Centering
// on the product band avoids both the top whitespace and the bottom
// caption without needing a per-image override.
const DEFAULT_BANNER_SCALE = 1.12;
const DEFAULT_BANNER_CROP = { position: "center 42%" };

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Deterministic (hashed from the store's own id) so a given business keeps
// the same banner across renders/pages, same rationale as
// getVendorFallbackColor above. Returns the crop transform pre-computed
// too, so every call site just spreads it into one style object.
export function getVendorPlaceholderBanner(storeId, businessCategory) {
  const bucket = CATEGORY_BANNERS[businessCategory] || RETAIL_BANNERS;
  const src = bucket[hashString(storeId || "") % bucket.length];
  return { src, scale: DEFAULT_BANNER_SCALE, position: DEFAULT_BANNER_CROP.position };
}
