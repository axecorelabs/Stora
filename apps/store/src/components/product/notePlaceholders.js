// "Note for the seller" placeholder, by category (packages/shared-constants
// categories.js's CATEGORY_VALUES) -- shared between ProductDetailsClient.js
// (the full product page) and QuickAddModal.js (the grid's quick-add), so
// a category's example text can't drift between the two. Falls back to a
// generic example for anything not listed here (dashboard's "Other" included).
export const NOTE_PLACEHOLDERS = {
  Food: 'e.g. no onions, extra spicy…',
  Beverages: 'e.g. extra cold, less ice…',
  Clothing: 'e.g. gift wrap, preferred fit…',
  Shoes: 'e.g. true to size, color preference…',
  Accessories: 'e.g. gift wrap, engraving request…',
  Perfumes: 'e.g. sample size, bundle request…',
  Electronics: 'e.g. original packaging, color preference…',
  Books: 'e.g. gift wrap, preferred edition…',
  'Home & Garden': 'e.g. delivery day, assembly request…',
  Sports: 'e.g. size or color preference…',
  Automotive: 'e.g. confirm fit for your vehicle model…',
  'Health & Beauty': 'e.g. shade or scent preference…',
  'Wigs & Hair': 'e.g. preferred length, texture, color match…',
  default: 'e.g. any special request…'
};
