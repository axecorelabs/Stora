// Natural-language prompts, same tone as AISearchInput's own placeholder
// examples -- tapping one lands straight on /products with AI mode already
// on and the query already submitted (mode=ai + q is exactly what
// products/page.js reads to do that on load). Shared between the homepage
// hero (AIHeroSearch.js) and CategoryDiscovery.js's own "Try asking Stora
// AI" row further down the page, so the two don't drift out of sync.
export const AI_SEARCH_TEMPLATES = [
  "Ankara styles for a wedding",
  "A gift under ₦20k",
  "Skincare for oily skin",
  "Vendors that deliver same day",
  "Native wears for men",
  "Home office setup",
];

// A longer list for any auto-scrolling row -- there's no "wall of pills"
// problem the way there would be wrapping this many in place, so it can
// afford more variety than the short, wrapped-in-place list above.
export const AI_SEARCH_TEMPLATES_MOBILE = [
  ...AI_SEARCH_TEMPLATES,
  "Affordable phones under ₦100k",
  "Same-day birthday cake",
  "Ankara for kids",
  "Sneakers under ₦15k",
  "Organic skincare",
  "Baby essentials starter pack",
  "Vendors based in Lagos",
  "Perfumes that last all day",
  "Home decor on a budget",
  "Everyday native wear for women",
];
