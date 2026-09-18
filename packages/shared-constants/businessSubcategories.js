// Curated subcategories grouped under each top-level business category.
// Values are stored in the DB; labels are for UI rendering.
export const BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY = {
  retail: [
    { value: 'supermarket', label: 'Supermarket' },
    { value: 'pharmacy', label: 'Pharmacy' },
    { value: 'fashion-boutique', label: 'Fashion Boutique' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'beauty-cosmetics', label: 'Beauty & Cosmetics' },
    { value: 'home-kitchen', label: 'Home & Kitchen' },
    { value: 'baby-kids', label: 'Baby & Kids' },
    { value: 'books-stationery', label: 'Books & Stationery' },
    { value: 'hardware-building', label: 'Hardware & Building Supplies' },
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
    { value: 'meal-prep', label: 'Meal Prep' }
  ],
  services: [
    { value: 'salon-barber', label: 'Salon & Barber' },
    { value: 'laundry-drycleaning', label: 'Laundry & Dry Cleaning' },
    { value: 'cleaning', label: 'Cleaning Services' },
    { value: 'repairs-tech', label: 'Repairs & Tech Support' },
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

// Single quick-picks complement combo presets for common one-tap choices.
// Each preset sets the primary subcategory only.
export const BUSINESS_SUBCATEGORY_SINGLE_PRESETS_BY_CATEGORY = {
  retail: [
    { key: 'single-supermarket', label: 'Supermarket', primary: 'supermarket' },
    { key: 'single-pharmacy', label: 'Pharmacy', primary: 'pharmacy' },
    { key: 'single-fashion', label: 'Fashion Boutique', primary: 'fashion-boutique' },
    { key: 'single-electronics', label: 'Electronics', primary: 'electronics' }
  ],
  restaurant: [
    { key: 'single-fastfood', label: 'Fast Food', primary: 'fast-food' },
    { key: 'single-local-kitchen', label: 'Local Kitchen', primary: 'local-kitchen' },
    { key: 'single-bakery', label: 'Bakery', primary: 'bakery' },
    { key: 'single-cafe', label: 'Cafe', primary: 'cafe' }
  ],
  services: [
    { key: 'single-salon', label: 'Salon & Barber', primary: 'salon-barber' },
    { key: 'single-laundry', label: 'Laundry & Dry Cleaning', primary: 'laundry-drycleaning' },
    { key: 'single-cleaning', label: 'Cleaning Services', primary: 'cleaning' },
    { key: 'single-repairs', label: 'Repairs & Tech Support', primary: 'repairs-tech' }
  ],
  hybrid: [
    { key: 'single-supermarket-pharmacy', label: 'Supermarket + Pharmacy', primary: 'supermarket-pharmacy' },
    { key: 'single-restaurant-grocery', label: 'Restaurant + Grocery', primary: 'restaurant-grocery' },
    { key: 'single-salon-retail', label: 'Salon + Retail', primary: 'salon-retail' },
    { key: 'single-cafe-bakery', label: 'Cafe + Bakery', primary: 'cafe-bakery' }
  ],
  other: [
    { key: 'single-non-profit', label: 'Non-profit / NGO', primary: 'non-profit' },
    { key: 'single-community', label: 'Community Group', primary: 'community' },
    { key: 'single-other-specialized', label: 'Other Specialized Business', primary: 'other-specialized' }
  ]
};
