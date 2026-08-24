import {
  Shirt,
  Footprints,
  Watch,
  Droplet,
  UtensilsCrossed,
  CupSoda,
  Smartphone,
  BookOpen,
  Home as HomeIcon,
  Dumbbell,
  Car,
  Sparkles,
  Scissors,
} from "lucide-react";

// Mirrors the dashboard's own "Add inventory" category dropdown
// (apps/dashboard/src/app/dashboard/inventory/add/page.js) -- category is
// freeform text at the database level, so this fixed list is a defensive
// choice: showing the known, actually-used options rather than trusting
// raw DISTINCT values (which pick up casing variants and "Other"). Shared
// between the homepage's discovery teaser and the /products search page.
export const CATEGORIES = [
  { value: "Clothing", icon: Shirt },
  { value: "Shoes", icon: Footprints },
  { value: "Accessories", icon: Watch },
  { value: "Perfumes", icon: Droplet },
  { value: "Food", icon: UtensilsCrossed },
  { value: "Beverages", icon: CupSoda },
  { value: "Electronics", icon: Smartphone },
  { value: "Books", icon: BookOpen },
  { value: "Home & Garden", icon: HomeIcon },
  { value: "Sports", icon: Dumbbell },
  { value: "Automotive", icon: Car },
  { value: "Health & Beauty", icon: Sparkles },
  { value: "Wigs & Hair", icon: Scissors },
];
