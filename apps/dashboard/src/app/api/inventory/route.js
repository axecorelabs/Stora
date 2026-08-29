import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { generateSKU, backfillMissingSkus } from '@/lib/inventorySku';
import { backfillMissingStoreIds } from '@/lib/inventoryStoreId';
import { embedProductById } from '@/lib/openrouter';
import { captureServerEvent } from '@/lib/posthog-server';
import { normalizeExtraDefinitions } from '@stora/shared-constants';

// Helper to transform inventory data for response (snake_case to camelCase).
// Every product has >=1 real inventory_variants row now (see
// 20260817000001_unify_inventory_variants.sql) -- stock/price are always
// derived from those rows, never a flat column on `inventory` itself.
// hasVariants is likewise derived (more than one row), not a stored flag
// that could drift from the real variant count.
function transformInventory(item, variants = []) {
  if (!item) return null;

  let images = [];
  try {
    const rawImages = item.images || [];
    images = rawImages.map(img => {
      if (typeof img === 'string') {
        try {
          return JSON.parse(img);
        } catch (e) {
          return { url: img };
        }
      }
      return img;
    });
  } catch (e) {
    images = [];
  }

  let primaryImage = item.primary_image || null;
  if (!primaryImage && images.length > 0) {
    const primaryImg = images.find(img => img && img.isPrimary);
    primaryImage = (primaryImg?.url) || (images[0]?.url) || null;
  }

  const transformedVariants = variants.map(v => ({
    id: v.id,
    _id: v.id,
    size: v.size,
    color: v.color,
    sku: v.sku,
    quantityInStock: v.quantity_in_stock,
    reservedQuantity: v.reserved_quantity,
    soldQuantity: v.sold_quantity,
    reorderLevel: v.reorder_level,
    images: v.images || [],
    barcode: v.barcode,
    isActive: v.is_active,
    price: v.price,
    costPrice: v.cost_price
  }));

  const totalStock = variants.reduce((sum, v) => sum + (v.quantity_in_stock || 0), 0);
  const totalReserved = variants.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0);
  const totalSold = variants.reduce((sum, v) => sum + (v.sold_quantity || 0), 0);
  // Today's product-create/edit UI only ever sets one price for the whole
  // product (applied to every variant identically) -- there's no
  // per-variant pricing UI yet, so the first variant's price/cost is
  // representative of all of them until that UI exists.
  const representativePrice = variants[0]?.price ?? 0;
  const representativeCost = variants[0]?.cost_price ?? 0;

  return {
    id: item.id,
    _id: item.id, // For backward compatibility
    mongoId: item.mongo_id,
    userId: item.user_id,
    productName: item.name,
    name: item.name,
    description: item.description,
    brand: item.brand,
    supplier: item.supplier,
    location: item.location,
    category: item.category,
    categoryDetails: item.category_details,
    variants: transformedVariants,
    hasVariants: variants.length > 1,
    sellingPrice: representativePrice,
    basePrice: representativePrice,
    costPrice: representativeCost,
    cost: representativeCost,
    sku: item.sku,
    barcode: item.barcode,
    quantityInStock: totalStock,
    stockQuantity: totalStock,
    quantityReserved: totalReserved,
    soldQuantity: totalSold,
    minimumStock: item.minimum_stock,
    reorderLevel: item.minimum_stock,
    unitOfMeasure: item.unit_of_measure || 'Piece',
    images: images,
    image: primaryImage, // Primary image URL for easy access
    primaryImage: primaryImage,
    tags: typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : item.tags || [],
    isActive: item.is_active,
    status: item.is_active ? 'Active' : 'Inactive',
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

// GET - Fetch user's inventory
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 100;
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') === '-1' ? false : true; // true = ascending
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const offset = (page - 1) * limit;

    // Map sortBy fields from MongoDB names to Supabase column names.
    // quantityInStock/sellingPrice are now variant-derived aggregates, not
    // real inventory columns -- sorting by them happens in JS after the
    // fetch (below) instead of in the query.
    const sortFieldMap = {
      'productName': 'name',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at'
    };
    const sortField = sortFieldMap[sortBy] || null;

    // Build query
    let query = supabaseAdmin
      .from('inventory')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Filter by category
    if (category) {
      query = query.eq('category', category);
    }

    // Filter by status (is_active)
    if (status === 'Active') {
      query = query.eq('is_active', true);
    } else if (status === 'Inactive') {
      query = query.eq('is_active', false);
    }

    // Search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (sortField) {
      query = query.order(sortField, { ascending: sortOrder });
    }
    // Deferred pagination: quantityInStock/sellingPrice sorting needs the
    // variant aggregate computed first (see below), so .range() for those
    // two happens after that instead of here.
    const deferredSort = !sortField;
    if (!deferredSort) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: inventory, error, count } = await query;

    if (error) {
      console.error('Inventory fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch inventory' },
        { status: 500 }
      );
    }

    // Backfill SKUs and store_id for items created before those were set
    await backfillMissingSkus(inventory);
    await backfillMissingStoreIds(inventory, user.id);

    const inventoryIds = inventory.map(item => item.id);

    // One batched fetch each for every product's variants and batches,
    // instead of a query per item.
    const { data: allVariants } = await supabaseAdmin
      .from('inventory_variants')
      .select('*')
      .in('inventory_id', inventoryIds);

    const { data: allBatches } = await supabaseAdmin
      .from('inventory_batches')
      .select('*')
      .in('inventory_id', inventoryIds)
      .order('date_received', { ascending: true });

    const variantsByInventory = {};
    (allVariants || []).forEach(v => {
      if (!variantsByInventory[v.inventory_id]) variantsByInventory[v.inventory_id] = [];
      variantsByInventory[v.inventory_id].push(v);
    });

    const batchesByInventory = {};
    (allBatches || []).forEach(batch => {
      if (!batchesByInventory[batch.inventory_id]) {
        batchesByInventory[batch.inventory_id] = [];
      }
      batchesByInventory[batch.inventory_id].push(batch);
    });

    // Enhance inventory items with batch pricing
    let enhancedInventory = inventory.map(item => {
      const variants = variantsByInventory[item.id] || [];
      const batches = batchesByInventory[item.id] || [];
      const transformedItem = transformInventory(item, variants);

      // Find the current active batch using FIFO logic
      const currentActiveBatch = batches.find(batch => {
        const remainingQuantity = (batch.quantity_remaining || 0);
        return remainingQuantity > 0 && batch.status === 'active';
      });

      let batchPricing = {
        currentCostPrice: transformedItem.costPrice,
        currentSellingPrice: transformedItem.sellingPrice,
        hasActiveBatch: false,
        activeBatchCode: null,
        activeBatchRemaining: 0
      };

      if (currentActiveBatch) {
        batchPricing = {
          currentCostPrice: currentActiveBatch.cost_price,
          currentSellingPrice: currentActiveBatch.selling_price,
          hasActiveBatch: true,
          activeBatchCode: currentActiveBatch.batch_code,
          activeBatchRemaining: currentActiveBatch.quantity_remaining,
          activeBatchId: currentActiveBatch.id,
          activeBatchDateReceived: currentActiveBatch.date_received
        };
      }

      // Calculate weighted averages
      const totalQuantityIn = batches.reduce((sum, batch) => sum + (batch.quantity_in || 0), 0);
      const weightedCostSum = batches.reduce((sum, batch) => sum + ((batch.cost_price || 0) * (batch.quantity_in || 0)), 0);
      const weightedSellingSum = batches.reduce((sum, batch) => sum + ((batch.selling_price || 0) * (batch.quantity_in || 0)), 0);

      const averageCostPrice = totalQuantityIn > 0 ? weightedCostSum / totalQuantityIn : transformedItem.costPrice;
      const averageSellingPrice = totalQuantityIn > 0 ? weightedSellingSum / totalQuantityIn : transformedItem.sellingPrice;

      return {
        ...transformedItem,
        batchPricing: {
          ...batchPricing,
          averageCostPrice,
          averageSellingPrice,
          totalBatches: batches.length,
          activeBatches: batches.filter(b => b.quantity_remaining > 0 && b.status === 'active').length
        },
        currentCostPrice: batchPricing.currentCostPrice,
        currentSellingPrice: batchPricing.currentSellingPrice,
        currentStockValue: transformedItem.stockQuantity * batchPricing.currentCostPrice,
        expectedRevenue: transformedItem.stockQuantity * batchPricing.currentSellingPrice,
        currentProfitMargin: batchPricing.currentCostPrice > 0
          ? (((batchPricing.currentSellingPrice - batchPricing.currentCostPrice) / batchPricing.currentCostPrice) * 100).toFixed(1)
          : 0
      };
    });

    if (deferredSort) {
      const key = sortBy === 'sellingPrice' ? 'sellingPrice' : 'quantityInStock';
      enhancedInventory.sort((a, b) => sortOrder ? a[key] - b[key] : b[key] - a[key]);
      enhancedInventory = enhancedInventory.slice(offset, offset + limit);
    }

    const total = count || 0;

    return NextResponse.json({
      success: true,
      data: enhancedInventory,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      },
      batchInfo: {
        note: 'Pricing reflects current active batch using FIFO methodology',
        methodology: 'First In, First Out (FIFO) - oldest batches are sold first'
      }
    });

  } catch (error) {
    console.error('Inventory fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new inventory item
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const inventoryData = await req.json();

    // Prepare category details based on category. Stored (and read back by
    // the storefront's ProductDetailsClient.js) keyed under the category
    // name -- category_details.food, not the flat food-details object
    // itself -- so this must nest it the same way, not assign it directly.
    let categoryDetails = null;
    if (inventoryData.category === 'Food' && inventoryData.foodDetails) {
      // Extras carry real money now (price + a per-extra max quantity) --
      // clamp/normalize here too, not just in the dashboard UI, so a raw
      // API call can't write a negative price or garbage max straight into
      // the JSONB column.
      categoryDetails = {
        food: {
          ...inventoryData.foodDetails,
          extras: normalizeExtraDefinitions(inventoryData.foodDetails.extras)
        }
      };
    } else if (inventoryData.category === 'Beverages' && inventoryData.beveragesDetails) {
      categoryDetails = { beverages: inventoryData.beveragesDetails };
    } else if (inventoryData.category === 'Books' && inventoryData.booksDetails) {
      categoryDetails = { books: inventoryData.booksDetails };
    }

    // The public storefront (apps/store) looks products up by store_id, so
    // items created without one are invisible there even with web visibility on
    const { data: userStore } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    // `inventory` is listing metadata only now -- no price/stock/variant
    // flag written here, those live exclusively on inventory_variants.
    const { data: newItem, error: invError } = await supabaseAdmin
      .from('inventory')
      .insert({
        user_id: user.id,
        store_id: userStore?.id || null,
        name: inventoryData.productName || inventoryData.name,
        description: inventoryData.description || '',
        category: inventoryData.category,
        category_details: categoryDetails,
        sku: inventoryData.sku || generateSKU(inventoryData.category, inventoryData.productName || inventoryData.name),
        barcode: inventoryData.barcode || null,
        minimum_stock: inventoryData.minimumStock || inventoryData.reorderLevel || 5,
        images: inventoryData.images || [],
        tags: inventoryData.tags || [],
        is_active: true
      })
      .select()
      .single();

    if (invError) {
      console.error('Inventory creation error:', invError);
      if (invError.code === '23505') {
        return NextResponse.json(
          { success: false, message: 'A product with this SKU already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: 'Failed to create inventory item' },
        { status: 500 }
      );
    }

    // Every product gets >=1 real inventory_variants row -- a product with
    // no real size/color options still gets exactly one "default" variant,
    // which is what actually carries its price/stock going forward.
    const sellingPrice = inventoryData.sellingPrice || inventoryData.basePrice || 0;
    const costPrice = inventoryData.costPrice || inventoryData.cost || 0;
    const providedVariants = Array.isArray(inventoryData.variants) && inventoryData.variants.length > 0
      ? inventoryData.variants
      : [{
          size: 'One Size',
          color: 'Default',
          quantityInStock: inventoryData.quantityInStock || inventoryData.stockQuantity || 0,
          reorderLevel: inventoryData.minimumStock || inventoryData.reorderLevel || 5
        }];

    const variantRows = providedVariants.map(v => ({
      inventory_id: newItem.id,
      size: v.size || 'One Size',
      color: v.color || 'Default',
      sku: v.sku || null,
      // Starts at 0, same as the product used to -- fn_create_batch below
      // is what actually sets it, atomically alongside a real batch, per
      // variant, so no variant ever has stock without a batch backing it.
      quantity_in_stock: 0,
      reorder_level: v.reorderLevel || 5,
      // Today's UI only sets one price for the whole product -- every
      // variant gets that same price/cost until per-variant pricing UI
      // exists.
      price: sellingPrice,
      cost_price: costPrice,
      images: v.images || [],
      is_active: true
    }));

    const { data: insertedVariants, error: variantsError } = await supabaseAdmin
      .from('inventory_variants')
      .insert(variantRows)
      .select();

    if (variantsError || !insertedVariants || insertedVariants.length === 0) {
      console.error('Variant creation error:', variantsError);
      // Roll back the product -- a product with zero variants violates the
      // "every product has >=1 variant" invariant the rest of the app now
      // depends on (checkout, POS, stock RPCs all require a real variant).
      await supabaseAdmin.from('inventory').delete().eq('id', newItem.id);
      return NextResponse.json(
        { success: false, message: 'Failed to create product variant' },
        { status: 500 }
      );
    }

    // One batch per variant that actually has starting stock, each created
    // via fn_create_batch so quantity_in_stock and its batch are set
    // atomically together (20260817000002_variant_only_rpcs.sql).
    const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const productCode = newItem.sku ? newItem.sku.split('-')[0] : 'PRD';
    const createdBatches = [];
    let batchSeq = 1;

    for (const variant of insertedVariants) {
      const source = providedVariants.find(v =>
        (v.color || 'Default') === variant.color && (v.size || 'One Size') === variant.size
      );
      const qty = source?.quantityInStock || 0;
      if (qty <= 0) continue;

      const batchCode = `${productCode}-${dateCode}-B${String(batchSeq).padStart(3, '0')}`;
      batchSeq += 1;

      const { data: batchResult, error: batchError } = await supabaseAdmin.rpc('fn_create_batch', {
        p_variant_id: variant.id,
        p_user_id: user.id,
        p_batch_code: batchCode,
        p_quantity_in: qty,
        p_cost_price: costPrice,
        p_selling_price: sellingPrice,
        p_supplier: inventoryData.supplier || '',
        p_notes: 'Initial stock batch - created with product',
        p_batch_location: inventoryData.location || 'Main Store',
        p_reason: `Created new inventory item: ${newItem.name}`
      });

      if (batchError) {
        console.error(`Initial batch creation error for variant ${variant.id}:`, batchError);
        // Don't fail the whole product for one variant's batch failing --
        // the product and its variant rows already exist; that variant
        // just starts at 0 stock instead, fixable via Add Batch afterward.
        continue;
      }

      const result = batchResult?.[0];
      createdBatches.push({ id: result?.batch_id, batchCode: result?.batch_code, variantId: variant.id, totalQuantity: qty });
    }

    // Re-fetch the variants so the response reflects their real post-batch
    // quantity_in_stock rather than the pre-batch 0 from the insert above.
    const { data: finalVariants } = await supabaseAdmin
      .from('inventory_variants')
      .select('*')
      .eq('inventory_id', newItem.id);

    // Deferred -- embedText is a real OpenRouter round trip, and a vendor
    // saving a product must never wait on (or fail because of) it. AI
    // search just won't surface this item until the embedding lands.
    after(() => embedProductById(newItem.id));

    after(() => captureServerEvent(user.id, 'inventory_item_created', {
      category: newItem.category,
      variant_count: finalVariants?.length || insertedVariants.length,
      initial_batch_created: createdBatches.length > 0
    }));

    return NextResponse.json({
      success: true,
      message: 'Inventory item and initial batch created successfully',
      data: {
        inventory: transformInventory(newItem, finalVariants || insertedVariants),
        initialBatch: createdBatches[0] ? {
          _id: createdBatches[0].id,
          id: createdBatches[0].id,
          batchCode: createdBatches[0].batchCode,
          totalQuantity: createdBatches.reduce((sum, b) => sum + b.totalQuantity, 0)
        } : null
      }
    });

  } catch (error) {
    console.error('Inventory creation error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
