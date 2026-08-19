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
    availableQuantity: Math.max(0, (v.quantity_in_stock || 0) - (v.reserved_quantity || 0)),
    reorderLevel: v.reorder_level,
    soldQuantity: v.sold_quantity,
    price: v.price,
    costPrice: v.cost_price,
    images: v.images,
    barcode: v.barcode,
    weight: v.weight,
    isActive: v.is_active
  }));

  const totalStock = transformedVariants.reduce((sum, v) => sum + (v.quantityInStock || 0), 0);
  const totalReserved = transformedVariants.reduce((sum, v) => sum + (v.quantityReserved || 0), 0);
  const totalSold = transformedVariants.reduce((sum, v) => sum + (v.soldQuantity || 0), 0);
  const totalAvailable = Math.max(0, totalStock - totalReserved);
  // "From ₦X" for a multi-variant product; the single variant's own price
  // for a simple product (its one "Default" variant).
  const prices = transformedVariants.map(v => v.price).filter(p => p != null);
  const representativePrice = prices.length > 0 ? Math.min(...prices) : 0;
  const representativeCost = transformedVariants[0]?.costPrice ?? 0;

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
    storeDescription: store.store_description,
    storeType: store.store_type,
    storePhone: store.store_phone,
    storeEmail: store.store_email,
    state: store.state,
    deliveryStates: store.delivery_states && store.delivery_states.length > 0 ? store.delivery_states : null,
    address: store.address,
    onlineStoreInfo: store.online_store_info,
    settings: store.settings,
    branding: store.branding,
    businessHours: store.business_hours,
    website: store.website,
    isVerified: store.is_verified,
    isActive: store.is_active,
    averageRating: store.average_rating,
    totalReviews: store.total_reviews,
    ownerId: store.owner_id,
    createdAt: store.created_at,
    updatedAt: store.updated_at
  };
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

  return transformStoreFields(data);
}

// Public store URLs are keyed by website.websitePath (a clean, editable slug),
// which is distinct from the store_slug column (generated once at creation with
// a random suffix, e.g. "korrys-fit-3555b3" vs websitePath "korrys-fit"). Try
// store_slug first for backwards compatibility, then fall back to websitePath.
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

  if (bySlug) return bySlug;

  const { data: byPath, error: pathError } = await supabaseAdmin
    .from('stores')
    .select('*')
    .contains('website', { websitePath: slug })
    .eq('is_active', true)
    .maybeSingle();

  if (pathError) {
    console.error('Error finding store by website path:', pathError);
    throw new Error('Failed to find store');
  }

  return byPath || null;
}

export async function findStoreBySlug(slug) {
  console.log('Finding store by slug:', slug);

  const data = await findActiveStoreByPathOrSlug(slug);

  if (!data) {
    console.log('No store found with slug:', slug);
    return null;
  }

  console.log('Store found:', data?.store_name);
  return transformStoreFields(data);
}

export async function findStoreByWebsitePath(websitePath) {
  try {
    const data = await findActiveStoreByPathOrSlug(websitePath);
    return transformStoreFields(data);
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
// gated on is_verified: none of the real stores in production carry that
// flag yet, so requiring it here would silently empty the whole section.
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

  return (data || []).map(transformStoreFields);
}

// Paginated, indexed vendor search for the dedicated /vendors page --
// distinct from findFeaturedStores (a small, cached homepage teaser with
// no search or pagination). Backed by the search_vendors() Postgres
// function (see 20260817000005_vendor_product_search.sql), which does the
// ILIKE-over-trigram-index search, sort, and count(*) OVER() pagination
// total in a single indexed query rather than pulling candidates into JS.
export async function searchVendorsPaginated({ search, sort = 'featured', limit = 24, offset = 0, categories, state, buyerState } = {}) {
  const { data, error } = await supabaseAdmin.rpc('search_vendors', {
    p_search: search || null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
    p_categories: categories?.length ? categories : null,
    p_state: state || null,
    p_buyer_state: buyerState || null
  });

  if (error) {
    console.error('Error searching vendors:', error);
    throw new Error('Failed to search vendors');
  }

  const rows = data || [];
  return {
    // Public, unauthenticated endpoint -- buildPublicStoreData (not
    // transformStoreFields) so owner_id/is_active never leak into the response.
    vendors: rows.map(row => buildPublicStoreData(row.vendor)),
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
    let query = supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true);

    // Apply additional filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    if (filters.webVisibility !== undefined) {
      query = query.eq('web_visibility', filters.webVisibility);
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
  // results afterward, which could silently under-fill the grid.
  const { data: enabledStores, error: enabledStoresError } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('is_active', true)
    .eq('website->>isEnabled', 'true');

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
    ? await supabaseAdmin.from('stores').select('id, store_name, store_slug, branding').in('id', storeIds)
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
        logo: store.branding?.logo || null,
        primaryColor: store.branding?.primaryColor || null,
        secondaryColor: store.branding?.secondaryColor || null
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
export async function searchProductsPaginated({ search, categories, sort = 'trending', limit = 24, offset = 0, minPrice, maxPrice, state, buyerState } = {}) {
  const { data, error } = await supabaseAdmin.rpc('search_products', {
    p_search: search || null,
    p_categories: categories?.length ? categories : null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
    p_min_price: minPrice ?? null,
    p_max_price: maxPrice ?? null,
    p_state: state || null,
    p_buyer_state: buyerState || null
  });

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
    ? await supabaseAdmin.from('stores').select('id, store_name, store_slug, branding, state').in('id', storeIds)
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
    storeDescription: store.store_description,
    storeType: store.store_type,
    storePhone: store.store_phone,
    storeEmail: store.store_email,
    state: store.state,
    deliveryStates: store.delivery_states && store.delivery_states.length > 0 ? store.delivery_states : null,
    address: store.address,
    onlineStoreInfo: store.online_store_info,
    settings: store.settings,
    branding: store.branding,
    businessHours: store.business_hours,
    isVerified: store.is_verified,
    averageRating: store.average_rating,
    totalReviews: store.total_reviews,
    createdAt: store.created_at
  };
}
