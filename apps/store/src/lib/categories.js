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
import { CATEGORY_VALUES } from "@stora/shared-constants";

// CATEGORY_VALUES is the single source of truth, shared with the
// dashboard's category dropdowns (see packages/shared-constants/
// categories.js) -- adding a category there flows through automatically
// here, this file only supplies the icon each one gets in this app's UI.
const ICONS = {
  Clothing: Shirt,
  Shoes: Footprints,
  Accessories: Watch,
  Perfumes: Droplet,
  Food: UtensilsCrossed,
  Beverages: CupSoda,
  Electronics: Smartphone,
  Books: BookOpen,
  "Home & Garden": HomeIcon,
  Sports: Dumbbell,
  Automotive: Car,
  "Health & Beauty": Sparkles,
  "Wigs & Hair": Scissors,
};

// Shared between the homepage's discovery teaser and the /products search
// page.
export const CATEGORIES = CATEGORY_VALUES.map((value) => ({ value, icon: ICONS[value] }));
