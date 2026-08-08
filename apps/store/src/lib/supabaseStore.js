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
  
  return {
    id: inventory.id,
    productName: inventory.name,
    sku: inventory.sku,
    category: inventory.category,
    brand: inventory.brand,
    description: inventory.description,
    image: inventory.primary_image,
    images: inventory.images,
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

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error finding inventory:', error);
      console.error('Query details:', { storeId, filters, table: 'inventory', column: 'store_id' });
      throw new Error('Failed to find inventory');
    }

    // Fetch variants for products that have them
    const productsWithVariants = await Promise.all(
      (data || []).map(async (item) => {
        if (item.has_variants) {
          const { data: variantsData } = await supabaseAdmin
            .from('inventory_variants')
            .select('*')
            .eq('inventory_id', item.id)
            .eq('is_active', true);
          
          if (variantsData && variantsData.length > 0) {
            item.variantsData = variantsData;
          }
        }
        return item;
      })
    );

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

// ============ PRODUCT ENRICHMENT ============

export async function enrichProductsWithBatches(products) {
  const enrichedProducts = await Promise.all(
    products.map(async (product) => {
      try {
        // Get active batches for this product
        const batches = await findActiveBatchesByInventoryId(product.id);
        
        // Calculate actual quantities
        const batchesWithQuantities = await calculateBatchQuantities(batches);
        
        // Filter to only batches with stock
        const activeBatches = batchesWithQuantities.filter(
          batch => batch.actualQuantityRemaining > 0
        );

        // Find current active batch (FIFO - first batch with stock)
        const currentActiveBatch = activeBatches.length > 0 ? activeBatches[0] : null;

        // Use batch pricing if available
        if (currentActiveBatch) {
          // Calculate available quantity from batches (already accounts for sold + reserved)
          const availableFromBatches = activeBatches.reduce(
            (sum, batch) => sum + batch.actualQuantityRemaining,
            0
          );
          
          return {
            ...product,
            sellingPrice: currentActiveBatch.selling_price,
            quantityInStock: availableFromBatches,
            batchInfo: {
              currentBatchCode: currentActiveBatch.batch_code,
              currentBatchPrice: currentActiveBatch.selling_price,
              totalBatches: activeBatches.length
            }
          };
        }

        // No active batches, return product as-is
        return product;
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
