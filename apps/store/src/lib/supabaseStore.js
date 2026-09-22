import { supabaseAdmin } from './supabase';

// ============ FIELD TRANSFORMATION UTILITIES ============

// Each entry in inventory.images can be an object ({url, isPrimary, colorTag}),
// or for legacy rows a JSON-encoded string or a bare URL string -- normalize
// once here so every consumer downstream (product grid, detail page, cart,
// variant selector) gets a consistent shape instead of each guessing at it.
function normalizeImages(images) {
  if (!Array.isArray(images)) return [];

  return images.map(img => {
    if (typeof img === 'string') {
      try {
        return JSON.parse(img);
      } catch (e) {
        return { url: img };
      }
    }
    return img;
  }).filter(img => img?.url);
}

// The dashboard never writes to inventory.primary_image -- it's always NULL.
// The real primary image lives in the (already-normalized) images array: the
// entry flagged isPrimary, else the first entry.
function getPrimaryImageUrl(normalizedImages) {
  if (normalizedImages.length === 0) return null;
  const primary = normalizedImages.find(img => img?.isPrimary);
  return primary?.url || normalizedImages[0]?.url || null;
}

// A made-to-order variant (see 20260915000000_made_to_order_menu_items.sql)
// has no real quantity_in_stock -- fn_reserve_stock gates it against
// maxOrdersPerDay instead at checkout time. This is just what the
// storefront treats its "available quantity" as everywhere else (product
// cards, the detail page's quantity stepper, cart validation) so none of
// that code has to special-case is_unlimited itself: comfortably above any
// typical reorder-level threshold (so it never misreads as low/out of
// stock), but not so large it reads as a literal, meaningless number if it
// were ever shown -- the real cap is enforced server-side regardless of
// what's selected here.
const UNLIMITED_DISPLAY_QUANTITY = 20;

// Every product has >=1 real inventory_variants row now (see
// 20260817000001_unify_inventory_variants.sql) -- stock/price/hasVariants
// are always derived from those, never a flat column on `inventory`.
// `inventory.variantsData` must always be populated by the caller (every
// find*/enrich* function below does this in one batched query).
function transformInventoryToProduct(inventory) {
  if (!inventory) return null;

  const variantRows = inventory.variantsData || [];
  const transformedVariants = variantRows.map(v => ({
    id: v.id,
    color: v.color,
    size: v.size,
    sku: v.sku,
    quantityInStock: v.quantity_in_stock,
    quantityReserved: v.reserved_quantity,
    availableQuantity: v.is_unlimited
      ? UNLIMITED_DISPLAY_QUANTITY
      : Math.max(0, (v.quantity_in_stock || 0) - (v.reserved_quantity || 0)),
    reorderLevel: v.reorder_level,
    soldQuantity: v.sold_quantity,
    price: v.price,
    costPrice: v.cost_price,
    images: v.images,
    barcode: v.barcode,
    weight: v.weight,
    isActive: v.is_active,
    isUnlimited: v.is_unlimited || false,
    maxOrdersPerDay: v.max_orders_per_day ?? null
  }));

  const totalStock = transformedVariants.reduce((sum, v) => sum + (v.quantityInStock || 0), 0);
  const totalReserved = transformedVariants.reduce((sum, v) => sum + (v.quantityReserved || 0), 0);
  const totalSold = transformedVariants.reduce((sum, v) => sum + (v.soldQuantity || 0), 0);
  // "From ₦X" for a multi-variant product; the single variant's own price
  // for a simple product (its one "Default" variant).
  const prices = transformedVariants.map(v => v.price).filter(p => p != null);
  const representativePrice = prices.length > 0 ? Math.min(...prices) : 0;
  const representativeCost = transformedVariants[0]?.costPrice ?? 0;
  // Food items (the only ones made-to-order applies to today) always have
  // exactly one variant -- mirror its unlimited display quantity/flag up to
  // the product level too, same as representativeCost/Price already do for
  // a single-variant product, so card/listing code reading the top-level
  // fields directly (not variants[0]) doesn't see a false "out of stock."
  const isUnlimited = transformedVariants.length === 1 && transformedVariants[0].isUnlimited;
  const totalAvailable = isUnlimited ? UNLIMITED_DISPLAY_QUANTITY : Math.max(0, totalStock - totalReserved);

  const normalizedImages = normalizeImages(inventory.images);

  return {
    id: inventory.id,
    productName: inventory.name,
    sku: inventory.sku,
    category: inventory.category,
    brand: inventory.brand,
    description: inventory.description,
    image: inventory.primary_image || getPrimaryImageUrl(normalizedImages),
    images: normalizedImages,
    sellingPrice: representativePrice,
    costPrice: representativeCost,
    quantityInStock: totalStock,
    quantityReserved: totalReserved,
    availableQuantity: totalAvailable,
    soldQuantity: totalSold,
    isUnlimited,
    maxOrdersPerDay: isUnlimited ? transformedVariants[0].maxOrdersPerDay : null,
    averageRating: inventory.average_rating != null ? Number(inventory.average_rating) : 0,
    totalReviews: inventory.total_reviews || 0,
    reorderLevel: inventory.minimum_stock,
    unitOfMeasure: inventory.unit_of_measure,
    location: inventory.location,
    supplier: inventory.supplier,
    tags: inventory.tags,
    attributes: inventory.attributes,
    isActive: inventory.is_active,
    storeId: inventory.store_id,
    createdAt: inventory.created_at,
    updatedAt: inventory.updated_at,
    hasVariants: transformedVariants.length > 1,
    variants: transformedVariants,
    categoryDetails: inventory.category_details,
    webVisibility: inventory.web_visibility,
    // Preserve batch info if present
    batchInfo: inventory.batchInfo
  };
}

function transformStoreFields(store) {
  if (!store) return null;

  return {
    id: store.id,
    storeName: store.store_name,
    storeSlug: store.store_slug,
    // The address every internal link should actually use -- the vendor's
    // own chosen address (website_path, see 20260924000000_website_path_
    // column.sql) when they've set one, falling back to store_slug
    // otherwise. storeSlug above stays for anything still reading it
    // directly; publicSlug is what VendorCard/VendorSearchCard/
    // [slug]/page.js's canonical URL etc. link through now.
    publicSlug: store.website_path || store.store_slug,
    storeDescription: store.store_description,
    storeType: store.store_type,
    restaurantMode: !!store.restaurant_mode,
    // Independent booleans set at business-creation time (CreateBusinessModal.js)
    // -- a business can be any combination of the three. sellsProducts
    // defaults true at the DB level (existing stores predate this column).
    sellsProducts: store.sells_products !== false,
    offersServices: !!store.offers_services,
    businessCategory: store.business_category || null,
    businessSubcategory: store.business_subcategory || null,
    businessSubcategories: Array.isArray(store.business_subcategories)
      ? store.business_subcategories
      : (store.business_subcategory ? [store.business_subcategory] : []),
    businessTags: Array.isArray(store.business_tags) ? store.business_tags : [],
    storePhone: store.store_phone,
    storeEmail: store.store_email,
    state: store.state,
    deliveryStates: store.delivery_states && store.delivery_states.length > 0 ? store.delivery_states : null,
    address: store.address,
    onlineStoreInfo: store.online_store_info,
    settings: store.settings,
    branding: store.branding,
    businessHours: store.business_hours,
    // Manual "closed right now" override -- combines with businessHours via
    // isStoreOpenNow (@stora/shared-constants) to derive real-time open/
    // closed status, consumed by ProductCard/StoreHeader for restaurant-mode
    // stores and by orders/create's own closed-store check.
    temporarilyClosed: !!store.temporarily_closed,
    website: store.website,
    // isVerified is the vendor's own identity check (QoreID NIN + live
    // selfie) -- confirms a real person, nothing about the business itself.
    // businessVerified is the actual "Verified by Stora" public trust badge:
    // staff-granted after a vendor contacts Stora directly, set via the
    // admin-only PATCH /api/stores/[storeId] toggle, never by the vendor.
    // Every public badge component reads businessVerified, not isVerified --
    // VerificationForm.js's own copy used to promise the individual identity
    // check earned this badge, which conflated the two.
    isVerified: store.is_verified,
    businessVerified: !!store.business_verified_at,
    isActive: store.is_active,
    // 'store' (full commerce) or 'listing' (showcase-only, paid monthly subscription).
    platformMode: store.platform_mode || 'store',
    subscriptionStatus: store.subscription_status || 'none',
    averageRating: store.average_rating,
    totalReviews: store.total_reviews,
    ownerId: store.owner_id,
    createdAt: store.created_at,
    updatedAt: store.updated_at
  };
}

function isWebsiteEnabled(website) {
  if (!website) return false;
  if (typeof website === 'string') {
    try {
      const parsed = JSON.parse(website);
      return !!parsed?.isEnabled;
    } catch {
      return false;
    }
  }
  return !!website?.isEnabled;
}

function getFullStoreGraceDays() {
  const raw = Number(process.env.FULL_STORE_SUBSCRIPTION_GRACE_DAYS ?? 7);
  if (!Number.isFinite(raw)) return 7;
  return Math.min(Math.max(Math.round(raw), 3), 7);
}

function getFullStoreEnforcementStartMs() {
  const configured = process.env.FULL_STORE_SUBSCRIPTION_ENFORCEMENT_START || '2026-09-30T00:00:00Z';
  const parsed = new Date(configured).getTime();
  if (!Number.isFinite(parsed)) {
    return new Date('2026-09-30T00:00:00Z').getTime();
  }
  return parsed;
}

function isFullStoreAccessAllowed(store, nowMs = Date.now()) {
  if (nowMs < getFullStoreEnforcementStartMs()) {
    return true;
  }

  const status = store?.full_store_subscription_status || 'none';
  if (status === 'active' || status === 'none') return true;

  if (status === 'past_due') {
    const graceEndsAt = store?.full_store_subscription_grace_ends_at;
    if (!graceEndsAt) {
      const fallbackBase = store?.updated_at ? new Date(store.updated_at).getTime() : nowMs;
      const fallbackGraceMs = getFullStoreGraceDays() * 24 * 60 * 60 * 1000;
      return fallbackBase + fallbackGraceMs > nowMs;
    }

    const graceExpiryMs = new Date(graceEndsAt).getTime();
    return Number.isFinite(graceExpiryMs) && graceExpiryMs > nowMs;
  }

  return false;
}

// Server-side public-visibility gate shared by storefront reads.
// Full stores: active + website enabled.
// Listing stores: active + website enabled + paid subscription.
function isPubliclyVisibleStore(store) {
  if (!store || store.is_active !== true) return false;
  if (!isWebsiteEnabled(store.website)) return false;

  const platformMode = store.platform_mode || 'store';
  if (platformMode === 'listing') {
    return store.subscription_status === 'active';
  }

  if (platformMode === 'store') {
    return isFullStoreAccessAllowed(store);
  }

  return true;
}

// Public storefront services -- mirrors apps/dashboard/src/lib/services.js's
// loadServiceDocument (same batched-query shape, no N+1) but only ever
// returns active items: the dashboard version intentionally includes
// inactive ones too, since that's the vendor's own management view, not
// what a shopper should see. Returns a flat array (not the dashboard's
// {_id, storeId, services} wrapper) since this is assigned directly onto
// store.services for ServicesSection to render.
export async function loadPublicServiceDocument(storeId) {
  const { data: service } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('store_id', storeId)
    .maybeSingle();

  if (!service) return [];

  const { data: items } = await supabaseAdmin
    .from('service_items')
    .select('*')
    .eq('service_id', service.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const itemIds = (items || []).map(i => i.id);
  let locationsByItem = {};

  if (itemIds.length > 0) {
    const { data: locations } = await supabaseAdmin
      .from('service_locations')
      .select('*')
      .in('service_item_id', itemIds);

    (locations || []).forEach(l => {
      if (!locationsByItem[l.service_item_id]) {
        locationsByItem[l.service_item_id] = { coverAllNigeria: false, states: [] };
      }
      if (l.cover_all_nigeria) locationsByItem[l.service_item_id].coverAllNigeria = true;
      if (l.state) {
        locationsByItem[l.service_item_id].states.push({
          state: l.state, coverAllCities: l.cover_all_cities, cities: l.cities || []
        });
      }
    });
  }

  return (items || []).map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    subCategory: item.sub_category,
    price: item.price,
    duration: item.duration,
    durationUnit: item.duration_unit,
    yearsOfExperience: item.years_of_experience,
    homeServiceAvailable: item.home_service_available,
    portfolioImages: item.portfolio_images || [],
    serviceLocations: locationsByItem[item.id] || { coverAllNigeria: false, states: [] }
  }));
}

// Attaches the services array onto an already-transformed store, only when
// the business actually offers services -- most stores don't, so this
// skips the extra round trip for the common case.
async function attachServices(store) {
  if (store?.offersServices) {
    store.services = await loadPublicServiceDocument(store.id);
  }
  return store;
}

// ============ STORE OPERATIONS ============

export async function findStoreById(storeId) {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error finding store:', error);
    throw new Error('Failed to find store');
  }

  return attachServices(transformStoreFields(data));
}

// Public store URLs are keyed by website_path (a clean, editable slug --
// its own indexed, unique column as of 20260924000000_website_path_
// column.sql), distinct from the store_slug column (generated once at
// creation with a random suffix, e.g. "korrys-fit-3555b3" vs website_path
// "korrys-fit"). Try store_slug first for backwards compatibility, then
// fall back to website_path -- both real indexed lookups now, not a
// scan. (Deliberately not a single .or() query: `slug` is unsanitized
// user input from the URL, and supabase-js's .or() takes a raw PostgREST
// filter string rather than a parameterized value the way .eq() does --
// interpolating it there would be a filter-injection risk.)
async function findActiveStoreByPathOrSlug(slug) {
  const { data: bySlug, error: slugError } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('store_slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (slugError) {
    console.error('Error finding store by store_slug:', slugError);
    throw new Error('Failed to find store');
  }

  if (bySlug) return isPubliclyVisibleStore(bySlug) ? bySlug : null;

  const { data: byPath, error: pathError } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('website_path', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (pathError) {
    console.error('Error finding store by website path:', pathError);
    throw new Error('Failed to find store');
  }

  if (!byPath) return null;
  return isPubliclyVisibleStore(byPath) ? byPath : null;
}

export async function findStoreBySlug(slug) {
  console.log('Finding store by slug:', slug);

  const data = await findActiveStoreByPathOrSlug(slug);

  if (!data) {
    console.log('No store found with slug:', slug);
    return null;
  }

  console.log('Store found:', data?.store_name);
  return attachServices(transformStoreFields(data));
}

export async function findStoreByWebsitePath(websitePath) {
  try {
    const data = await findActiveStoreByPathOrSlug(websitePath);
    return attachServices(transformStoreFields(data));
  } catch (error) {
    console.error('Database connection error for store lookup:', error.message);
    // Re-throw to let the page handle it gracefully
    throw error;
  }
}

// Cross-vendor listing for the homepage's vendor showcase -- every other
// store lookup in this file is scoped to one known store. Ordered by
// total_orders/average_rating first (real differentiators once the
// platform has volume), falling back to newest-first, since on a young
// platform most stores are still tied at zero on both. Deliberately not
// gated on business_verified_at (the "Verified by Stora" badge): none of
// the real stores in production carry that flag yet, so requiring it here
// would silently empty the whole section.
export async function findFeaturedStores({ limit = 12 } = {}) {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .eq('website->>isEnabled', 'true')
    .order('total_orders', { ascending: false })
    .order('average_rating', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error finding featured stores:', error);
    throw new Error('Failed to find featured stores');
  }

  return (data || [])
    .filter(isPubliclyVisibleStore)
    .map(transformStoreFields);
}

// Paginated, indexed vendor search for the dedicated /vendors page --
// distinct from findFeaturedStores (a small, cached homepage teaser with
// no search or pagination). Backed by the search_vendors() Postgres
// function (see 20260817000005_vendor_product_search.sql), which does the
// ILIKE-over-trigram-index search, sort, and count(*) OVER() pagination
// total in a single indexed query rather than pulling candidates into JS.
export async function searchVendorsPaginated({
  search,
  sort = 'featured',
  limit = 24,
  offset = 0,
  categories,
  state,
  buyerState,
  deliverableOnly,
  scope,
  businessCategory,
  businessSubcategory,
  businessSubcategories
} = {}) {
  const rpcParams = {
    p_search: search || null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
    p_categories: categories?.length ? categories : null,
    p_state: state || null,
    p_buyer_state: buyerState || null
  };
  // Only sent when actually true/set -- app deploys and DB migrations
  // aren't applied atomically together here (no CI step runs the SQL
  // migrations), so there's a real window where this code ships before
  // the DB function knows about p_deliverable_only/p_scope. Omitting the
  // key when unused means the RPC call still matches the OLD function
  // signature during that window, so ordinary browsing keeps working;
  // only the new filter itself is unavailable until the migration runs.
  if (deliverableOnly) rpcParams.p_deliverable_only = true;
  // 'products' | 'services' -- the /vendors scope toggle (see
  // 20260913000000_search_vendors_services.sql). 'all' (the default) is
  // never sent, same as any other unset filter.
  if (scope === 'products' || scope === 'services') rpcParams.p_scope = scope;
  if (businessCategory) rpcParams.p_business_category = businessCategory;
  if (businessSubcategory) rpcParams.p_business_subcategory = businessSubcategory;
  if (Array.isArray(businessSubcategories) && businessSubcategories.length > 0) {
    rpcParams.p_business_subcategories = businessSubcategories;
  }

  let { data, error } = await supabaseAdmin.rpc('search_vendors', rpcParams);

  if (error && (rpcParams.p_business_subcategory || rpcParams.p_business_subcategories)) {
    const fallbackParams = { ...rpcParams };
    delete fallbackParams.p_business_subcategory;
    delete fallbackParams.p_business_subcategories;
    const fallback = await supabaseAdmin.rpc('search_vendors', fallbackParams);
    data = fallback.data;
    error = fallback.error;
  }

  // Deploys and SQL migrations are not atomic in this repo. If code ships
  // first, retry once without the new arg so existing search keeps working.
  if (error && rpcParams.p_business_category) {
    const fallbackParams = { ...rpcParams };
    delete fallbackParams.p_business_category;
    const fallback = await supabaseAdmin.rpc('search_vendors', fallbackParams);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error('Error searching vendors:', error);
    throw new Error('Failed to search vendors');
  }

  const rows = data || [];
  const visibleRows = rows.filter(row => isPubliclyVisibleStore(row.vendor));
  return {
    // Public, unauthenticated endpoint -- buildPublicStoreData (not
    // transformStoreFields) so owner_id/is_active never leak into the response.
    vendors: visibleRows.map(row => buildPublicStoreData(row.vendor)),
    totalCount: rows[0]?.total_count ?? 0
  };
}

// AI search's retrieval step -- ranks by embedding similarity
// (search_vendors_ai) instead of ILIKE, otherwise the same shape/response
// as searchVendorsPaginated above so callers (the AI search route) can
// treat both result sets identically.
export async function searchVendorsByEmbedding({
  embedding,
  categories,
  state,
  buyerState,
  deliverableOnly,
  scope,
  businessCategory,
  businessSubcategory,
  businessSubcategories,
  limit = 24,
  offset = 0
} = {}) {
  const rpcParams = {
    p_embedding: embedding,
    p_categories: categories?.length ? categories : null,
    p_state: state || null,
    p_buyer_state: buyerState || null,
    p_limit: limit,
    p_offset: offset
  };
  if (deliverableOnly) rpcParams.p_deliverable_only = true;
  if (scope === 'products' || scope === 'services') rpcParams.p_scope = scope;
  if (businessCategory) rpcParams.p_business_category = businessCategory;
  if (businessSubcategory) rpcParams.p_business_subcategory = businessSubcategory;
  if (Array.isArray(businessSubcategories) && businessSubcategories.length > 0) {
    rpcParams.p_business_subcategories = businessSubcategories;
  }

  let { data, error } = await supabaseAdmin.rpc('search_vendors_ai', rpcParams);

  if (error && (rpcParams.p_business_subcategory || rpcParams.p_business_subcategories)) {
    const fallbackParams = { ...rpcParams };
    delete fallbackParams.p_business_subcategory;
    delete fallbackParams.p_business_subcategories;
    const fallback = await supabaseAdmin.rpc('search_vendors_ai', fallbackParams);
    data = fallback.data;
    error = fallback.error;
  }

  if (error && rpcParams.p_business_category) {
    const fallbackParams = { ...rpcParams };
    delete fallbackParams.p_business_category;
    const fallback = await supabaseAdmin.rpc('search_vendors_ai', fallbackParams);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error('Error searching vendors by embedding:', error);
    throw new Error('Failed to search vendors');
  }

  const rows = data || [];
  const visibleRows = rows.filter(row => isPubliclyVisibleStore(row.vendor));
  return {
    vendors: visibleRows.map(row => buildPublicStoreData(row.vendor)),
    totalCount: rows[0]?.total_count ?? 0
  };
}

// ============ BITERAVE (FOOD-ONLY STOREFRONT) SEARCH ============
// Mirrors searchProductsPaginated/searchProductsByEmbedding/
// searchVendorsPaginated/searchVendorsByEmbedding above exactly (same
// post-processing pipeline), calling the search_biterave_* SQL functions
// (20260905000000_biterave_search.sql) instead -- those hard-scope every
// result to category='Food' and a real, indexed is_meal_item column
// (never a caller-supplied category, since Biterave's whole premise is a
// food-only storefront), which is also what makes real LIMIT/OFFSET
// pagination correct here (a JS-side meal/grocery filter after the fact
// would silently break pagination across pages).

export async function searchBiteraveProducts({ mealOnly, search, storeId, cuisine, sort = 'trending', limit = 24, offset = 0, minPrice, maxPrice, state, buyerState, deliverableOnly } = {}) {
  const rpcParams = {
    p_meal_only: mealOnly,
    p_search: search || null,
    p_store_id: storeId || null,
    p_cuisine: cuisine || null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
    p_min_price: minPrice ?? null,
    p_max_price: maxPrice ?? null,
    p_state: state || null,
    p_buyer_state: buyerState || null
  };
  if (deliverableOnly) rpcParams.p_deliverable_only = true;

  const { data, error } = await supabaseAdmin.rpc('search_biterave_products', rpcParams);

  if (error) {
    console.error('Error searching Biterave products:', error);
    throw new Error('Failed to search products');
  }

  const rows = data || [];
  const totalCount = rows[0]?.total_count ?? 0;
  const items = rows.map(row => row.product);
  if (items.length === 0) return { products: [], totalCount };

  const withVariants = await attachVariants(items);
  const products = withVariants.map(transformInventoryToProduct);

  const storeIds = [...new Set(products.map(p => p.storeId).filter(Boolean))];
  const { data: stores, error: storesError } = storeIds.length > 0
    ? await supabaseAdmin.from('stores').select('id, store_name, store_slug, website_path, branding, state').in('id', storeIds)
    : { data: [], error: null };

  if (storesError) {
    console.error('Error fetching stores for Biterave product search:', storesError);
  }

  const storeById = new Map((stores || []).map(s => [s.id, s]));
  const withStores = products.map(product => {
    const store = storeById.get(product.storeId);
    return {
      ...product,
      store: store ? {
        storeName: store.store_name,
        storeSlug: store.store_slug,
        publicSlug: store.website_path || store.store_slug,
        logo: store.branding?.logo || null,
        primaryColor: store.branding?.primaryColor || null,
        secondaryColor: store.branding?.secondaryColor || null,
        state: store.state
      } : null
    };
  });

  return { products: await enrichProductsWithBatches(withStores), totalCount };
}

export async function searchBiteraveProductsByEmbedding({ mealOnly, embedding, storeId, cuisine, minPrice, maxPrice, state, buyerState, deliverableOnly, limit = 24, offset = 0 } = {}) {
  const rpcParams = {
    p_meal_only: mealOnly,
    p_embedding: embedding,
    p_store_id: storeId || null,
    p_cuisine: cuisine || null,
    p_min_price: minPrice ?? null,
    p_max_price: maxPrice ?? null,
    p_state: state || null,
    p_buyer_state: buyerState || null,
    p_limit: limit,
    p_offset: offset
  };
  if (deliverableOnly) rpcParams.p_deliverable_only = true;

  const { data, error } = await supabaseAdmin.rpc('search_biterave_products_ai', rpcParams);

  if (error) {
    console.error('Error searching Biterave products by embedding:', error);
    throw new Error('Failed to search products');
  }

  const rows = data || [];
  const totalCount = rows[0]?.total_count ?? 0;
  const items = rows.map(row => row.product);
  if (items.length === 0) return { products: [], totalCount };

  const withVariants = await attachVariants(items);
  const products = withVariants.map(transformInventoryToProduct);

  const storeIds = [...new Set(products.map(p => p.storeId).filter(Boolean))];
  const { data: stores, error: storesError } = storeIds.length > 0
    ? await supabaseAdmin.from('stores').select('id, store_name, store_slug, website_path, branding, state').in('id', storeIds)
    : { data: [], error: null };

  if (storesError) {
    console.error('Error fetching stores for Biterave AI product search:', storesError);
  }

  const storeById = new Map((stores || []).map(s => [s.id, s]));
  const withStores = products.map(product => {
    const store = storeById.get(product.storeId);
    return {
      ...product,
      store: store ? {
        storeName: store.store_name,
        storeSlug: store.store_slug,
        publicSlug: store.website_path || store.store_slug,
        logo: store.branding?.logo || null,
        primaryColor: store.branding?.primaryColor || null,
        secondaryColor: store.branding?.secondaryColor || null,
        state: store.state
      } : null
    };
  });

  return { products: await enrichProductsWithBatches(withStores), totalCount };
}

export async function searchBiteraveVendors({ mealOnly, search, sort = 'featured', limit = 24, offset = 0, state, buyerState, deliverableOnly } = {}) {
  const rpcParams = {
    p_meal_only: mealOnly,
    p_search: search || null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
    p_state: state || null,
    p_buyer_state: buyerState || null
  };
  if (deliverableOnly) rpcParams.p_deliverable_only = true;

  const { data, error } = await supabaseAdmin.rpc('search_biterave_vendors', rpcParams);

  if (error) {
    console.error('Error searching Biterave vendors:', error);
    throw new Error('Failed to search vendors');
  }

  const rows = data || [];
  const visibleRows = rows.filter(row => isPubliclyVisibleStore(row.vendor));
  return {
    vendors: visibleRows.map(row => buildPublicStoreData(row.vendor)),
    totalCount: rows[0]?.total_count ?? 0
  };
}

export async function searchBiteraveVendorsByEmbedding({ mealOnly, embedding, state, buyerState, deliverableOnly, limit = 24, offset = 0 } = {}) {
  const rpcParams = {
    p_meal_only: mealOnly,
    p_embedding: embedding,
    p_state: state || null,
    p_buyer_state: buyerState || null,
    p_limit: limit,
    p_offset: offset
  };
  if (deliverableOnly) rpcParams.p_deliverable_only = true;

  const { data, error } = await supabaseAdmin.rpc('search_biterave_vendors_ai', rpcParams);

  if (error) {
    console.error('Error searching Biterave vendors by embedding:', error);
    throw new Error('Failed to search vendors');
  }

  const rows = data || [];
  const visibleRows = rows.filter(row => isPubliclyVisibleStore(row.vendor));
  return {
    vendors: visibleRows.map(row => buildPublicStoreData(row.vendor)),
    totalCount: rows[0]?.total_count ?? 0
  };
}

// ============ INVENTORY/PRODUCT OPERATIONS ============

// Defensive cap, not real pagination UI -- a typical Nigerian SME catalog on
// this platform runs tens to low hundreds of active SKUs. Comfortably above
// any realistic size while still bounding worst-case payload and the fan-out
// of the variants/batches IN() queries downstream. If a store ever hits
// this, the console.warn below surfaces it before it becomes a customer
// complaint -- real pagination UI would be a separate product decision.
const STORE_CATALOG_LIMIT = 500;

// Every product now has >=1 real variant row -- always batch-fetch them,
// no has_variants gate.
async function attachVariants(items) {
  const ids = items.map(item => item.id);
  if (ids.length === 0) return items;

  const { data: allVariants, error } = await supabaseAdmin
    .from('inventory_variants')
    .select('*')
    .in('inventory_id', ids)
    .eq('is_active', true);

  if (error) {
    console.error('Error finding inventory variants:', error);
    return items;
  }

  const variantsByInventoryId = (allVariants || []).reduce((acc, v) => {
    (acc[v.inventory_id] ||= []).push(v);
    return acc;
  }, {});

  return items.map(item => {
    item.variantsData = variantsByInventoryId[item.id] || [];
    return item;
  });
}

export async function findInventoryByStoreId(storeId, filters = {}) {
  try {
    // web_visibility is always enforced here, not opt-in -- every caller of
    // this function lives in the customer-facing store app (never the
    // dashboard), so there's no legitimate case where a hidden item should
    // ever reach a shopper. This used to be conditional on filters.webVisibility
    // being explicitly passed, and two of this function's three call sites
    // (the store's own "hottest read in the app" and the client-side
    // useProducts() endpoint both new products pages revalidate through)
    // never passed it -- confirmed live: a vendor toggling an item to
    // "hidden from website" had it keep showing up on their storefront
    // regardless, exactly because of that gap.
    let query = supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .eq('web_visibility', true);

    // Apply additional filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(STORE_CATALOG_LIMIT);

    if (error) {
      console.error('Error finding inventory:', error);
      console.error('Query details:', { storeId, filters, table: 'inventory', column: 'store_id' });
      throw new Error('Failed to find inventory');
    }

    const items = data || [];
    if (items.length === STORE_CATALOG_LIMIT) {
      console.warn('Store catalog fetch hit STORE_CATALOG_LIMIT', { storeId });
    }

    const productsWithVariants = await attachVariants(items);
    return productsWithVariants.map(transformInventoryToProduct);
  } catch (err) {
    console.error('Exception in findInventoryByStoreId:', err);
    throw err;
  }
}

// A cheap, count-only check -- used once, server-side, to decide whether
// a store's products page renders in "client" mode (fetch everything,
// filter in memory -- fine for the vast majority of vendors) or "server"
// mode (real search/filter/sort/pagination, once a catalog is genuinely
// too large for that). Same store_id/is_active/web_visibility filter as
// findInventoryByStoreId, covered by the same idx_inventory_store_active
// index -- this is a single indexed round-trip, not a scan.
export async function countStoreProducts(storeId) {
  const { count, error } = await supabaseAdmin
    .from('inventory')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('is_active', true)
    .eq('web_visibility', true)
    .eq('is_deleted', false);

  if (error) {
    console.error('Error counting store products:', error);
    throw new Error('Failed to count products');
  }

  return count || 0;
}

// The category pill row's option list, for server mode specifically --
// that mode never holds the full catalog in memory to derive this from
// client-side the way today's client-mode useMemo does. A real DISTINCT
// query (fn_store_categories), not "fetch everything and dedupe in JS,"
// which would defeat the entire point for a large catalog.
export async function getStoreCategories(storeId) {
  const { data, error } = await supabaseAdmin.rpc('fn_store_categories', { p_store_id: storeId });

  if (error) {
    console.error('Error fetching store categories:', error);
    throw new Error('Failed to fetch categories');
  }

  return (data || []).map(row => row.category);
}

// Server-side search/filter/sort/pagination for one store's own product
// listing (fn_store_products_search) -- used only once countStoreProducts
// crosses the size threshold where fetching everything client-side stops
// being the right call. Mirrors searchProductsPaginated's exact shape
// (attachVariants + transformInventoryToProduct + enrichProductsWithBatches
// run on the returned page afterward) since the RPC returns the same
// TABLE(product inventory, total_count BIGINT) shape search_products does
// -- no per-product store attachment needed here, unlike the cross-vendor
// version, since every result already belongs to the one known storeId.
export async function searchStoreProducts(storeId, { search, category, sort = 'default', limit = 24, offset = 0 } = {}) {
  const { data, error } = await supabaseAdmin.rpc('fn_store_products_search', {
    p_store_id: storeId,
    p_search: search || null,
    p_category: category || null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset
  });

  if (error) {
    console.error('Error searching store products:', error);
    throw new Error('Failed to search products');
  }

  const rows = data || [];
  const totalCount = rows[0]?.total_count ?? 0;
  const items = rows.map(row => row.product);
  if (items.length === 0) return { products: [], totalCount };

  const withVariants = await attachVariants(items);
  const products = withVariants.map(transformInventoryToProduct);

  return { products: await enrichProductsWithBatches(products), totalCount };
}

// Cross-vendor listing for the homepage's discovery grid -- every other
// product query in this file is scoped to one known store_id.
// inventory.sold_quantity is a trigger-maintained rollup of
// inventory_variants.sold_quantity (see
// 20260817000007_denormalize_sold_quantity_and_cache.sql), not a value
// this or any other write path sets directly -- it exists purely so
// "trending" can be a single indexed SQL ORDER BY instead of pulling a
// candidate pool into JS to sum and re-sort (which was also subtly wrong:
// a true top-seller outside the recency-ordered candidate window would
// never surface).
export async function findDiscoverableProducts({ category, search, sort = 'trending', limit = 12 } = {}) {
  // A disabled-website vendor's products would otherwise still surface
  // here and link straight into a storefront that now 404s (see the
  // website.isEnabled checks in [slug]/page.js and siblings) -- exclude
  // them at the query itself rather than filtering the already-limited
  // results afterward, which could silently under-fill the grid. Listing-
  // mode businesses are intentionally showcase-only, so keep them out of
  // global product discovery even if their listing website is enabled.
  const { data: enabledStores, error: enabledStoresError } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('is_active', true)
    .eq('website->>isEnabled', 'true')
    .neq('platform_mode', 'listing');

  if (enabledStoresError) {
    console.error('Error finding enabled stores:', enabledStoresError);
    throw new Error('Failed to find discoverable products');
  }

  const enabledStoreIds = (enabledStores || []).map(s => s.id);
  if (enabledStoreIds.length === 0) return [];

  let query = supabaseAdmin
    .from('inventory')
    .select('*')
    .in('store_id', enabledStoreIds)
    .eq('is_active', true)
    .eq('web_visibility', true)
    .eq('is_deleted', false);

  if (category) {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  query = sort === 'trending'
    ? query.order('sold_quantity', { ascending: false }).order('created_at', { ascending: false })
    : query.order('created_at', { ascending: false });

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error('Error finding discoverable products:', error);
    throw new Error('Failed to find discoverable products');
  }

  const items = data || [];
  if (items.length === 0) return [];

  const withVariants = await attachVariants(items);
  const products = withVariants.map(transformInventoryToProduct);

  // Attach each product's own vendor info -- a cross-vendor card needs its
  // own store's slug (to link to the right storefront) and brand colors
  // (this platform's own two-layer brand rule: vendor-owned content stays
  // in the vendor's own color, not Stora's), unlike a single-store page
  // where that context is already implicit.
  const storeIds = [...new Set(products.map(p => p.storeId).filter(Boolean))];
  const { data: stores, error: storesError } = storeIds.length > 0
    ? await supabaseAdmin.from('stores').select('id, store_name, store_slug, website_path, branding, restaurant_mode, business_hours, temporarily_closed').in('id', storeIds)
    : { data: [], error: null };

  if (storesError) {
    console.error('Error fetching stores for discoverable products:', storesError);
  }

  const storeById = new Map((stores || []).map(s => [s.id, s]));

  return await enrichProductsWithBatches(products.map(product => {
    const store = storeById.get(product.storeId);
    return {
      ...product,
      store: store ? {
        storeName: store.store_name,
        storeSlug: store.store_slug,
        publicSlug: store.website_path || store.store_slug,
        logo: store.branding?.logo || null,
        primaryColor: store.branding?.primaryColor || null,
        secondaryColor: store.branding?.secondaryColor || null,
        restaurantMode: !!store.restaurant_mode,
        businessHours: store.business_hours,
        temporarilyClosed: !!store.temporarily_closed
      } : null
    };
  }));
}

// Paginated, indexed product search for the dedicated /products page --
// distinct from findDiscoverableProducts (a small, cached homepage teaser
// capped at DISCOVERY_CANDIDATE_LIMIT with no real pagination). Backed by
// the search_products() Postgres function (see
// 20260817000005_vendor_product_search.sql), which does the ILIKE-over-
// trigram-index search, category filter, trending-sort rollup join, and
// count(*) OVER() pagination total in a single indexed query -- the sort
// already happened in SQL, so (unlike findDiscoverableProducts) there's no
// JS-side re-sort here.
export async function searchProductsPaginated({ search, categories, sort = 'trending', limit = 24, offset = 0, minPrice, maxPrice, state, buyerState, deliverableOnly } = {}) {
  const rpcParams = {
    p_search: search || null,
    p_categories: categories?.length ? categories : null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
    p_min_price: minPrice ?? null,
    p_max_price: maxPrice ?? null,
    p_state: state || null,
    p_buyer_state: buyerState || null
  };
  // Only sent when actually true -- see searchVendorsPaginated's comment
  // on why this has to degrade gracefully rather than always being sent.
  if (deliverableOnly) rpcParams.p_deliverable_only = true;

  const { data, error } = await supabaseAdmin.rpc('search_products', rpcParams);

  if (error) {
    console.error('Error searching products:', error);
    throw new Error('Failed to search products');
  }

  const rows = data || [];
  const totalCount = rows[0]?.total_count ?? 0;
  const items = rows.map(row => row.product);
  if (items.length === 0) return { products: [], totalCount };

  const withVariants = await attachVariants(items);
  const products = withVariants.map(transformInventoryToProduct);

  // Same per-product store attachment as findDiscoverableProducts, see its
  // comment -- a cross-vendor card needs its own store's slug/colors.
  const storeIds = [...new Set(products.map(p => p.storeId).filter(Boolean))];
  const { data: stores, error: storesError } = storeIds.length > 0
    ? await supabaseAdmin.from('stores').select('id, store_name, store_slug, website_path, branding, state').in('id', storeIds)
    : { data: [], error: null };

  if (storesError) {
    console.error('Error fetching stores for product search:', storesError);
  }

  const storeById = new Map((stores || []).map(s => [s.id, s]));
  const withStores = products.map(product => {
    const store = storeById.get(product.storeId);
    return {
      ...product,
      store: store ? {
        storeName: store.store_name,
        storeSlug: store.store_slug,
        publicSlug: store.website_path || store.store_slug,
        logo: store.branding?.logo || null,
        primaryColor: store.branding?.primaryColor || null,
        secondaryColor: store.branding?.secondaryColor || null,
        state: store.state
      } : null
    };
  });

  return { products: await enrichProductsWithBatches(withStores), totalCount };
}

// AI search's retrieval step -- ranks by embedding similarity
// (search_products_ai) instead of ILIKE, otherwise identical post-
// processing (variants, store attachment, batch pricing) to
// searchProductsPaginated above.
export async function searchProductsByEmbedding({ embedding, categories, minPrice, maxPrice, state, buyerState, deliverableOnly, limit = 24, offset = 0 } = {}) {
  const rpcParams = {
    p_embedding: embedding,
    p_categories: categories?.length ? categories : null,
    p_min_price: minPrice ?? null,
    p_max_price: maxPrice ?? null,
    p_state: state || null,
    p_buyer_state: buyerState || null,
    p_limit: limit,
    p_offset: offset
  };
  if (deliverableOnly) rpcParams.p_deliverable_only = true;

  const { data, error } = await supabaseAdmin.rpc('search_products_ai', rpcParams);

  if (error) {
    console.error('Error searching products by embedding:', error);
    throw new Error('Failed to search products');
  }

  const rows = data || [];
  const totalCount = rows[0]?.total_count ?? 0;
  const items = rows.map(row => row.product);
  if (items.length === 0) return { products: [], totalCount };

  const withVariants = await attachVariants(items);
  const products = withVariants.map(transformInventoryToProduct);

  const storeIds = [...new Set(products.map(p => p.storeId).filter(Boolean))];
  const { data: stores, error: storesError } = storeIds.length > 0
    ? await supabaseAdmin.from('stores').select('id, store_name, store_slug, website_path, branding, state').in('id', storeIds)
    : { data: [], error: null };

  if (storesError) {
    console.error('Error fetching stores for AI product search:', storesError);
  }

  const storeById = new Map((stores || []).map(s => [s.id, s]));
  const withStores = products.map(product => {
    const store = storeById.get(product.storeId);
    return {
      ...product,
      store: store ? {
        storeName: store.store_name,
        storeSlug: store.store_slug,
        publicSlug: store.website_path || store.store_slug,
        logo: store.branding?.logo || null,
        primaryColor: store.branding?.primaryColor || null,
        secondaryColor: store.branding?.secondaryColor || null,
        state: store.state
      } : null
    };
  });

  return { products: await enrichProductsWithBatches(withStores), totalCount };
}

export async function findInventoryById(inventoryId) {
  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .eq('id', inventoryId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error finding inventory item:', error);
    throw new Error('Failed to find inventory item');
  }

  const [withVariants] = await attachVariants([data]);
  return transformInventoryToProduct(withVariants);
}

// Batched sibling of findInventoryById -- one query for a whole list of
// product ids instead of one query per id (used by checkout validation,
// which previously called findInventoryById once per cart item).
export async function findInventoryByIds(inventoryIds) {
  if (!inventoryIds || inventoryIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .in('id', inventoryIds);

  if (error) {
    console.error('Error finding inventory items by ids:', error);
    throw new Error('Failed to find inventory items');
  }

  const items = await attachVariants(data || []);
  return items.map(transformInventoryToProduct);
}

// ============ INVENTORY BATCH OPERATIONS ============

export async function findActiveBatchesByInventoryId(inventoryId) {
  const { data, error } = await supabaseAdmin
    .from('inventory_batches')
    .select('*')
    .eq('inventory_id', inventoryId)
    .eq('status', 'active')
    .order('date_received', { ascending: true }); // FIFO

  if (error) {
    console.error('Error finding batches:', error);
    throw new Error('Failed to find batches');
  }

  return data || [];
}

// Batched sibling of findActiveBatchesByInventoryId -- one query for a whole
// product list instead of one query per product. Returns batches grouped by
// inventory_id; each group is still date_received-ascending (FIFO) since
// Postgres returns the single query's rows in that order and grouping via
// reduce preserves it.
export async function findActiveBatchesByInventoryIds(inventoryIds) {
  if (!inventoryIds || inventoryIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from('inventory_batches')
    .select('*')
    .in('inventory_id', inventoryIds)
    .eq('status', 'active')
    .order('date_received', { ascending: true }); // FIFO

  if (error) {
    console.error('Error finding batches:', error);
    throw new Error('Failed to find batches');
  }

  return (data || []).reduce((acc, batch) => {
    (acc[batch.inventory_id] ||= []).push(batch);
    return acc;
  }, {});
}

export async function calculateBatchQuantities(batches) {
  return batches.map(batch => {
    // Available quantity = quantity_in - quantity_sold - quantity_reserved
    const actualQuantityRemaining = Math.max(
      0,
      (batch.quantity_in || 0) - (batch.quantity_sold || 0) - (batch.quantity_reserved || 0)
    );
    return {
      ...batch,
      actualQuantityRemaining
    };
  });
}

// ============ BATCH PRICING RESOLUTION ============

// Single source of truth for "what should a customer see as this product's
// (or one specific variant's) current price and available stock," given the
// product row (with .variants attached) and its (already status='active'-
// filtered) batches. Every batch now carries a real variant_id
// (20260817000001_unify_inventory_variants.sql) -- this function scopes to
// one variant's own batches when variantId is given (product detail page,
// once a size/color is picked, and checkout/cart, which always operate on
// one specific variant); when it's omitted (listing cards, initial detail-
// page render before a variant is picked), it resolves the product's sole
// variant automatically if there's only one, or aggregates a "from ₦X" /
// summed-stock view across all of them for a genuine multi-variant product.
export async function resolveBatchPricing(product, batches, variantId = null) {
  const variants = product.variants || [];
  const resolvedVariantId = variantId || (variants.length === 1 ? variants[0].id : null);

  const scopedBatches = resolvedVariantId
    ? batches.filter(b => b.variant_id === resolvedVariantId)
    : batches;

  const batchesWithQuantities = await calculateBatchQuantities(scopedBatches);
  const activeBatches = batchesWithQuantities.filter(b => b.actualQuantityRemaining > 0);
  const currentBatch = activeBatches.length > 0 ? activeBatches[0] : null;
  const isBatchTracked = scopedBatches.length > 0;

  let sellingPrice;
  let availableQuantity;

  if (resolvedVariantId) {
    const variant = variants.find(v => v.id === resolvedVariantId);
    sellingPrice = currentBatch ? currentBatch.selling_price : (variant?.price ?? product.sellingPrice ?? 0);
    availableQuantity = isBatchTracked
      ? activeBatches.reduce((sum, b) => sum + b.actualQuantityRemaining, 0)
      : (variant?.availableQuantity ?? product.availableQuantity ?? 0);
  } else {
    // Genuine multi-variant product with no single variant selected yet --
    // "from" price and total stock across every variant.
    const prices = variants.map(v => v.price).filter(p => p != null);
    sellingPrice = prices.length > 0 ? Math.min(...prices) : (product.sellingPrice ?? 0);
    availableQuantity = variants.length > 0
      ? variants.reduce((sum, v) => sum + (v.availableQuantity || 0), 0)
      : (product.availableQuantity ?? product.quantityInStock ?? 0);
  }

  const prices = activeBatches.map(b => b.selling_price);
  const totalQuantityIn = batchesWithQuantities.reduce((sum, b) => sum + (b.quantity_in || 0), 0);
  const weightedSellingSum = batchesWithQuantities.reduce(
    (sum, b) => sum + ((b.selling_price || 0) * (b.quantity_in || 0)), 0
  );

  return {
    sellingPrice,
    // Both fields set to the same resolved number -- ProductCard.js and
    // ProductDetailsClient.js key their sold-out/low-stock badges off
    // availableQuantity, while list/detail payloads have historically
    // also carried quantityInStock; keeping both in sync here is what the
    // duplicated call sites failed to do.
    quantityInStock: availableQuantity,
    availableQuantity,
    variantId: resolvedVariantId,
    activeBatches,
    batchesWithQuantities,
    currentBatch,
    batchInfo: {
      hasBatches: activeBatches.length > 0,
      isBatchTracked,
      totalBatches: activeBatches.length,
      totalAvailableQuantity: availableQuantity,
      currentBatchId: currentBatch?.id,
      currentBatchCode: currentBatch?.batch_code,
      currentBatchRemaining: currentBatch ? currentBatch.actualQuantityRemaining : 0,
      priceRange: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
      oldestBatchDate: activeBatches.length > 0 ? activeBatches[0]?.date_received : null,
      newestBatchDate: activeBatches.length > 0 ? activeBatches[activeBatches.length - 1]?.date_received : null,
      averagePrice: totalQuantityIn > 0 ? weightedSellingSum / totalQuantityIn : sellingPrice,
      methodology: 'FIFO - First In, First Out (oldest batches sold first)'
    }
  };
}

// ============ PRODUCT ENRICHMENT ============

export async function enrichProductsWithBatches(products) {
  let batchesByProduct = {};
  try {
    batchesByProduct = await findActiveBatchesByInventoryIds(products.map(p => p.id));
  } catch (batchError) {
    console.error('Error batch-fetching inventory batches:', batchError);
    // batchesByProduct stays {} -- every product falls through to "return
    // product as-is" below, same as today's per-item catch behavior.
  }

  const enrichedProducts = await Promise.all(
    products.map(async (product) => {
      try {
        // Batches for this product, pre-fetched in one query above instead
        // of one query per product. No variantId here -- this is the
        // listing-card view, which resolves the product's sole variant
        // automatically or aggregates across variants for a multi-variant
        // product (see resolveBatchPricing).
        const batches = batchesByProduct[product.id] || [];
        const { sellingPrice, quantityInStock, availableQuantity, batchInfo } =
          await resolveBatchPricing(product, batches);

        return {
          ...product,
          sellingPrice,
          quantityInStock,
          availableQuantity,
          batchInfo
        };
      } catch (batchError) {
        console.error(`Error processing batches for product ${product.id}:`, batchError);
        return product;
      }
    })
  );

  return enrichedProducts;
}

// ============ STORE UTILITY FUNCTIONS ============

export function sanitizeStore(store) {
  if (!store) return null;

  const {
    bank_details,
    ...sanitized
  } = store;

  return sanitized;
}

export function buildPublicStoreData(store) {
  if (!store) return null;

  // If already transformed, return as is
  if (store.storeName) return store;

  // Otherwise transform
  return {
    id: store.id,
    storeName: store.store_name,
    storeSlug: store.store_slug,
    publicSlug: store.website_path || store.store_slug,
    storeDescription: store.store_description,
    storeType: store.store_type,
    restaurantMode: !!store.restaurant_mode,
    // Cheap booleans, safe to include in bulk search results (unlike a
    // full `services` array, which transformStoreFields adds separately --
    // this function's callers map over many rows at once, so a per-row
    // services sub-query here would be a real N+1).
    sellsProducts: store.sells_products !== false,
    offersServices: !!store.offers_services,
    businessCategory: store.business_category || null,
    businessSubcategory: store.business_subcategory || null,
    businessSubcategories: Array.isArray(store.business_subcategories)
      ? store.business_subcategories
      : (store.business_subcategory ? [store.business_subcategory] : []),
    businessTags: Array.isArray(store.business_tags) ? store.business_tags : [],
    storePhone: store.store_phone,
    storeEmail: store.store_email,
    state: store.state,
    deliveryStates: store.delivery_states && store.delivery_states.length > 0 ? store.delivery_states : null,
    address: store.address,
    onlineStoreInfo: store.online_store_info,
    settings: store.settings,
    branding: store.branding,
    businessHours: store.business_hours,
    // Manual "closed right now" override -- combines with businessHours via
    // isStoreOpenNow (@stora/shared-constants) to derive real-time open/
    // closed status, consumed by ProductCard/StoreHeader for restaurant-mode
    // stores and by orders/create's own closed-store check.
    temporarilyClosed: !!store.temporarily_closed,
    // isVerified is the vendor's own identity check (QoreID NIN + live
    // selfie) -- confirms a real person, nothing about the business itself.
    // businessVerified is the actual "Verified by Stora" public trust badge:
    // staff-granted after a vendor contacts Stora directly, set via the
    // admin-only PATCH /api/stores/[storeId] toggle, never by the vendor.
    // Every public badge component reads businessVerified, not isVerified --
    // VerificationForm.js's own copy used to promise the individual identity
    // check earned this badge, which conflated the two.
    isVerified: store.is_verified,
    businessVerified: !!store.business_verified_at,
    platformMode: store.platform_mode || 'store',
    subscriptionStatus: store.subscription_status || 'none',
    averageRating: store.average_rating,
    totalReviews: store.total_reviews,
    createdAt: store.created_at
  };
}

// Gallery images for a listing-mode store's showcase page.
// Only exposed here (not through a public API route) -- the store app
// renders the showcase as a Server Component and fetches directly.
export async function findGalleryByStoreId(storeId) {
  const { data, error } = await supabaseAdmin
    .from('gallery_items')
    .select('id, image_url, caption, sort_order')
    .eq('store_id', storeId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching gallery:', error);
    return [];
  }
  return data || [];
}
