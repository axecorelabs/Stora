import { supabaseAdmin } from './supabase';

// ============ FIELD TRANSFORMATION UTILITIES ============

/**
 * Calculate available quantity accounting for reservations
 * 
 * QUANTITY CALCULATION LOGIC:
 * - For inventory: available = stock_quantity - quantity_reserved
 * - For inventory_batches: available = quantity_in - quantity_sold - quantity_reserved
 * - For inventory_variants: available = quantity_in_stock - quantity_reserved
 * 
 * NOTES:
 * - stock_quantity: Current physical stock level (actual DB column)
 * - quantity_reserved: Stock reserved for pending orders (may not exist yet)
 * - availableQuantity: What customers can actually order right now
 * 
 * FALLBACK: If quantity_reserved column doesn't exist, use stock_quantity directly
 */
function calculateAvailableQuantity(inventory) {
  // Use actual database column names: stock_quantity (not quantity_in_stock)
  const stockQuantity = inventory.stock_quantity || 0;
  const quantityReserved = inventory.quantity_reserved || 0;

  const available = Math.max(0, stockQuantity - quantityReserved);

  return available;
}

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

function transformInventoryToProduct(inventory) {
  if (!inventory) return null;
  
  const availableQuantity = calculateAvailableQuantity(inventory);
  
  // Transform variants from inventory_variants table if they exist
  let transformedVariants = [];
  if (inventory.variantsData && Array.isArray(inventory.variantsData)) {
    transformedVariants = inventory.variantsData.map(v => ({
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
  }
  
  console.log(`[Transform] Product: ${inventory.name}, Stock: ${inventory.stock_quantity}, Reserved: ${inventory.quantity_reserved || 0}, Available: ${availableQuantity}, Variants: ${transformedVariants.length}`);

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
    sellingPrice: inventory.base_price,
    costPrice: inventory.cost,
    quantityInStock: inventory.stock_quantity,
    quantityReserved: inventory.quantity_reserved || 0,
    availableQuantity: availableQuantity,
    soldQuantity: inventory.sold_quantity || 0,
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
    // Additional fields from actual schema
    hasVariants: inventory.has_variants,
    variants: transformedVariants, // Use transformed variants from inventory_variants table
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
    address: store.address,
    onlineStoreInfo: store.online_store_info,
    settings: store.settings,
    branding: store.branding,
    businessHours: store.business_hours,
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

export async function updateStoreMetrics(storeId, updates) {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .update(updates)
    .eq('id', storeId)
    .select()
    .single();

  if (error) {
    console.error('Error updating store metrics:', error);
    throw new Error('Failed to update store metrics');
  }

  return data;
}

// ============ INVENTORY/PRODUCT OPERATIONS ============

// Defensive cap, not real pagination UI -- a typical Nigerian SME catalog on
// this platform runs tens to low hundreds of active SKUs. Comfortably above
// any realistic size while still bounding worst-case payload and the fan-out
// of the variants/batches IN() queries downstream. If a store ever hits
// this, the console.warn below surfaces it before it becomes a customer
// complaint -- real pagination UI would be a separate product decision.
const STORE_CATALOG_LIMIT = 500;

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

    // Fetch variants for every product that has them in one batched query
    // instead of one query per product.
    const idsWithVariants = items.filter(item => item.has_variants).map(item => item.id);
    let variantsByInventoryId = {};
    if (idsWithVariants.length > 0) {
      const { data: allVariants, error: variantsError } = await supabaseAdmin
        .from('inventory_variants')
        .select('*')
        .in('inventory_id', idsWithVariants)
        .eq('is_active', true);

      if (variantsError) {
        console.error('Error finding inventory variants:', variantsError);
      } else {
        variantsByInventoryId = (allVariants || []).reduce((acc, v) => {
          (acc[v.inventory_id] ||= []).push(v);
          return acc;
        }, {});
      }
    }

    const productsWithVariants = items.map((item) => {
      const variantsData = variantsByInventoryId[item.id];
      if (variantsData && variantsData.length > 0) {
        item.variantsData = variantsData;
      }
      return item;
    });

    // Transform all inventory items to product format
    return productsWithVariants.map(transformInventoryToProduct);
  } catch (err) {
    console.error('Exception in findInventoryByStoreId:', err);
    throw err;
  }
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

  // Fetch variants if product has variants
  if (data.has_variants) {
    const { data: variantsData } = await supabaseAdmin
      .from('inventory_variants')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('is_active', true);
    
    if (variantsData && variantsData.length > 0) {
      data.variantsData = variantsData;
    }
  }

  return transformInventoryToProduct(data);
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

  const items = data || [];
  const idsWithVariants = items.filter(item => item.has_variants).map(item => item.id);

  let variantsByInventoryId = {};
  if (idsWithVariants.length > 0) {
    const { data: allVariants, error: variantsError } = await supabaseAdmin
      .from('inventory_variants')
      .select('*')
      .in('inventory_id', idsWithVariants)
      .eq('is_active', true);

    if (variantsError) {
      console.error('Error finding inventory variants by ids:', variantsError);
    } else {
      variantsByInventoryId = (allVariants || []).reduce((acc, v) => {
        (acc[v.inventory_id] ||= []).push(v);
        return acc;
      }, {});
    }
  }

  return items.map((item) => {
    const variantsData = variantsByInventoryId[item.id];
    if (variantsData && variantsData.length > 0) {
      item.variantsData = variantsData;
    }
    return transformInventoryToProduct(item);
  });
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
// current price and available stock," given its product row and its
// (already status='active'-filtered) batches. This used to be 4+ near-
// duplicate inline implementations (the storefront listing enrichment, the
// product details page -- twice, once for metadata and once for the page
// itself --, the single-product API route, and three places in
// supabaseCart.js). That duplication is exactly how two real bugs crept in
// and diverged silently between call sites:
//
// 1. The details page reassigned its "current price" with `const` inside
//    an if-block, shadowing the outer variable instead of updating it, so
//    the page always displayed the stale flat inventory.base_price no
//    matter what the batches actually priced the item at.
// 2. Every call site computed `activeBatches.reduce(...) || product.X` --
//    which, because 0 is falsy, silently revived the (possibly stale)
//    flat inventory field whenever a batch-tracked product's batches were
//    all fully depleted, instead of correctly reporting zero stock. Only
//    `batches.length` (unfiltered) can tell "never batch-tracked" (a
//    legitimate reason to fall back to flat inventory) apart from
//    "batch-tracked but currently sold out" (should report 0, not a
//    stale flat number) -- `activeBatches.length`/its reduce sum cannot,
//    since both cases produce the same empty/zero result.
export async function resolveBatchPricing(product, batches) {
  const batchesWithQuantities = await calculateBatchQuantities(batches);
  const activeBatches = batchesWithQuantities.filter(b => b.actualQuantityRemaining > 0);
  const currentBatch = activeBatches.length > 0 ? activeBatches[0] : null;

  // Whether this product has ever been stocked via batches at all --
  // distinct from activeBatches.length, which is 0 both when there are no
  // batches AND when there are batches but all are depleted.
  const isBatchTracked = batches.length > 0;

  const sellingPrice = currentBatch ? currentBatch.selling_price : product.sellingPrice;
  const availableQuantity = isBatchTracked
    ? activeBatches.reduce((sum, b) => sum + b.actualQuantityRemaining, 0)
    : (product.availableQuantity ?? product.quantityInStock ?? 0);

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
        // of one query per product.
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
