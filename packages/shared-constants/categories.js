// Single source of truth for product categories, shared between
// apps/dashboard (vendor-facing category dropdowns) and apps/store
// (public category filters, and the AI search extraction prompt's
// category enum). Previously duplicated independently in apps/store's
// lib/categories.js and three separate dashboard forms (inventory/add,
// AddInventoryModal, EditInventoryModal) -- those now derive from here.
//
// Deliberately excludes "Other" -- that's a dashboard-only escape hatch
// for products that don't fit any of these, not a real taxonomy value
// customers should be able to filter or search by.
export const CATEGORY_VALUES = [
  'Clothing',
  'Shoes',
  'Accessories',
  'Perfumes',
  'Food',
  'Beverages',
  'Electronics',
  'Books',
  'Home & Garden',
  'Sports',
  'Automotive',
  'Health & Beauty',
  'Wigs & Hair'
];
