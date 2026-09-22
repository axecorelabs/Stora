// Curated subcategories grouped under each top-level business category.
// Values are stored in the DB; labels are for UI rendering.
export const BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY = {
  retail: [
    { value: 'supermarket', label: 'Supermarket' },
    // Distinct from Supermarket on purpose -- a different scale of
    // business (the small neighborhood shop/kiosk), not just a synonym,
    // so a micro-retailer has an accurate size-appropriate option instead
    // of being forced into "Supermarket".
    { value: 'provisions-store', label: 'Provisions Store / Mini-Mart' },
    { value: 'pharmacy', label: 'Pharmacy' },
    { value: 'fashion-boutique', label: 'Fashion Boutique' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'beauty-cosmetics', label: 'Beauty & Cosmetics' },
    { value: 'home-kitchen', label: 'Home & Kitchen' },
    { value: 'furniture-decor', label: 'Furniture & Home Decor' },
    { value: 'baby-kids', label: 'Baby & Kids' },
    { value: 'books-stationery', label: 'Books & Stationery' },
    { value: 'hardware-building', label: 'Hardware & Building Supplies' },
    { value: 'agro-farm-supplies', label: 'Agriculture & Farm Supplies' },
    { value: 'auto-parts', label: 'Auto Parts' }
  ],
  restaurant: [
    { value: 'fast-food', label: 'Fast Food' },
    { value: 'local-kitchen', label: 'Local Kitchen' },
    { value: 'bakery', label: 'Bakery' },
    { value: 'cafe', label: 'Cafe' },
    { value: 'grill-bbq', label: 'Grill & BBQ' },
    { value: 'desserts', label: 'Desserts' },
    { value: 'drinks-juice', label: 'Drinks & Juice' },
    { value: 'bar-lounge', label: 'Bar & Lounge' },
    { value: 'meal-prep', label: 'Meal Prep' }
  ],
  // Search's own AI intent-extraction prompt (apps/store/src/lib/
  // openrouter.js) and its keyword-fallback lists (apps/store/src/app/api/
  // search/ai/route.js's SERVICE_INTENT_TERMS) already recognize
  // "tailor"/"photographer"/"caterer" etc. as valid service-search intent,
  // but before this there was no matching subcategory for any of them --
  // a real tailor or photographer had nowhere accurate to register under,
  // and fell into the generic "Repairs & Tech Support" catch-all (which
  // reads as electronics/appliance repair) or nothing at all. Also splits
  // "Repairs & Tech Support" itself: it was carrying phone/appliance
  // repair, auto mechanics, AND home trades (electricians/plumbers) all at
  // once -- three genuinely different trades a customer searches for
  // differently.
  services: [
    { value: 'salon-barber', label: 'Salon & Barber' },
    { value: 'laundry-drycleaning', label: 'Laundry & Dry Cleaning' },
    { value: 'cleaning', label: 'Cleaning Services' },
    { value: 'repairs-tech', label: 'Repairs & Tech Support' },
    { value: 'automotive', label: 'Automotive Services' },
    { value: 'home-trades', label: 'Home & Construction Trades' },
    { value: 'tailoring', label: 'Tailoring & Alterations' },
    { value: 'photography-videography', label: 'Photography & Videography' },
    { value: 'catering', label: 'Catering Services' },
    { value: 'security', label: 'Security Services' },
    { value: 'printing-branding', label: 'Printing, Branding & Design' },
    { value: 'real-estate', label: 'Real Estate & Property' },
    { value: 'logistics-dispatch', label: 'Logistics & Dispatch' },
    { value: 'events', label: 'Events Services' },
    { value: 'health-wellness', label: 'Health & Wellness' },
    { value: 'education-training', label: 'Education & Training' }
  ],
  hybrid: [
    { value: 'supermarket-pharmacy', label: 'Supermarket + Pharmacy' },
    { value: 'restaurant-grocery', label: 'Restaurant + Grocery' },
    { value: 'salon-retail', label: 'Salon + Retail' },
    { value: 'cafe-bakery', label: 'Cafe + Bakery' },
    { value: 'service-retail', label: 'Service + Retail' }
  ],
  other: [
    { value: 'non-profit', label: 'Non-profit / NGO' },
    { value: 'community', label: 'Community Group' },
    { value: 'other-specialized', label: 'Other Specialized Business' }
  ]
};

// Suggested quick-pick combinations to speed up onboarding and settings edits.
// `primary` becomes business_subcategory; `secondary` fills business_subcategories.
export const BUSINESS_SUBCATEGORY_COMBOS_BY_CATEGORY = {
  retail: [
    {
      key: 'supermarket-pharmacy-household',
      label: 'Supermarket + Pharmacy + Household',
      primary: 'supermarket',
      secondary: ['pharmacy', 'home-kitchen']
    },
    {
      key: 'fashion-beauty-kids',
      label: 'Fashion + Beauty + Kids',
      primary: 'fashion-boutique',
      secondary: ['beauty-cosmetics', 'baby-kids']
    },
    {
      key: 'electronics-accessories',
      label: 'Electronics + Accessories',
      primary: 'electronics',
      secondary: ['auto-parts']
    }
  ],
  restaurant: [
    {
      key: 'fastfood-grill-drinks',
      label: 'Fast Food + Grill + Drinks',
      primary: 'fast-food',
      secondary: ['grill-bbq', 'drinks-juice']
    },
    {
      key: 'bakery-cafe-desserts',
      label: 'Bakery + Cafe + Desserts',
      primary: 'bakery',
      secondary: ['cafe', 'desserts']
    }
  ],
  services: [
    {
      key: 'salon-beauty-wellness',
      label: 'Salon + Beauty + Wellness',
      primary: 'salon-barber',
      secondary: ['health-wellness']
    },
    {
      key: 'dispatch-logistics-repairs',
      label: 'Dispatch + Logistics + Repairs',
      primary: 'logistics-dispatch',
      secondary: ['repairs-tech']
    }
  ],
  hybrid: [
    {
      key: 'restaurant-grocery-bakery',
      label: 'Restaurant + Grocery + Bakery',
      primary: 'restaurant-grocery',
      secondary: ['bakery']
    },
    {
      key: 'salon-retail-beauty',
      label: 'Salon + Retail + Service',
      primary: 'salon-retail',
      secondary: ['service-retail']
    }
  ],
  other: []
};
