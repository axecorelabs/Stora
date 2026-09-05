import { Scissors, Shirt, PartyPopper, Home as HomeIcon, Smartphone, UtensilsCrossed } from "lucide-react";

// The 6 top-level service categories (see AddServiceModal.js's CATEGORIES
// in the dashboard -- that's the actual source of truth for what
// service_items.category can be, this just supplies icons for this app's
// UI). Kept separate from apps/store/src/lib/categories.js's product
// CATEGORIES: the two taxonomies never share a string value, so this list
// exists only to swap the /vendors category-chip set when the scope
// toggle is set to "Services" -- merging both into one ~19-chip list
// would bury each taxonomy in the other's options.
export const SERVICE_CATEGORIES = [
  { value: 'Beauty & Personal Care', icon: Scissors },
  { value: 'Fashion & Style', icon: Shirt },
  { value: 'Events & Creative Lifestyle', icon: PartyPopper },
  { value: 'Home & Domestic', icon: HomeIcon },
  { value: 'Mobile & Personal Convenience', icon: Smartphone },
  { value: 'Food & Everyday Living', icon: UtensilsCrossed }
];
