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

// Same photo as the landing page hero (apps/store/src/app/page.js) --
// reused here so an unbranded business's card still feels like part of
// Stora's own visual identity instead of a flat, empty rectangle.
export const VENDOR_CARD_PLACEHOLDER_BANNER = "/IMG_6315%202.webp";
