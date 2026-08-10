import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { generateSKU, backfillMissingSkus } from '@/lib/inventorySku';

// Helper to transform inventory data for response (snake_case to camelCase)
function transformInventory(item) {
  if (!item) return null;
  
  // Parse images safely - each image in the array may be a JSON string
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
  
  // Get primary image URL - prefer database field, fallback to images array
  let primaryImage = item.primary_image || null;
  
  // Fallback: if no primary_image in DB, try to find from images array
  if (!primaryImage && images.length > 0) {
    const primaryImg = images.find(img => img && img.isPrimary);
    primaryImage = (primaryImg?.url) || (images[0]?.url) || null;
  }
  
  // Parse variants safely - may be double-stringified JSON
  let variants = [];
  try {
    if (item.variants) {
      let parsed = item.variants;
      // Parse until we get an array (handles double or single stringification)
      while (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      variants = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error('Error parsing variants:', e);
    variants = [];
  }
  
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
    variants: variants,
    hasVariants: item.has_variants || (variants.length > 0),
    sellingPrice: item.base_price,
    basePrice: item.base_price,
    costPrice: item.cost,
    cost: item.cost,
    sku: item.sku,
    barcode: item.barcode,
    quantityInStock: item.stock_quantity,
    stockQuantity: item.stock_quantity,
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

// Helper to transform batch data
function transformBatch(batch) {
  if (!batch) return null;
  return {
    id: batch.id,
    _id: batch.id,
    mongoId: batch.mongo_id,
    userId: batch.user_id,
    productId: batch.inventory_id,
    batchCode: batch.batch_code,
    quantityIn: batch.quantity_in,
    quantitySold: batch.quantity_sold,
    quantityRemaining: batch.quantity_remaining,
    costPrice: batch.cost_price,
    sellingPrice: batch.selling_price,
    dateReceived: batch.date_received,
    expiryDate: batch.expiry_date,
    supplier: batch.supplier,
    notes: batch.notes,
    status: batch.status,
    batchLocation: batch.batch_location,
    archivedAt: batch.archived_at,
    createdAt: batch.created_at,
    updatedAt: batch.updated_at
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

    // Map sortBy fields from MongoDB names to Supabase column names
    const sortFieldMap = {
      'productName': 'name',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'quantityInStock': 'stock_quantity',
      'sellingPrice': 'base_price'
    };
    const sortField = sortFieldMap[sortBy] || sortBy;

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

    // Apply sorting and pagination
    query = query
      .order(sortField, { ascending: sortOrder })
      .range(offset, offset + limit - 1);

    const { data: inventory, error, count } = await query;

    if (error) {
      console.error('Inventory fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch inventory' },
        { status: 500 }
      );
    }

    // Backfill SKUs for items created before SKU generation existed
    await backfillMissingSkus(inventory);

    // Get batches for all inventory items for pricing
    const inventoryIds = inventory.map(item => item.id);
    
    const { data: allBatches } = await supabaseAdmin
      .from('inventory_batches')
      .select('*')
      .in('inventory_id', inventoryIds)
      .order('date_received', { ascending: true });

    // Group batches by inventory_id
    const batchesByInventory = {};
    (allBatches || []).forEach(batch => {
      if (!batchesByInventory[batch.inventory_id]) {
        batchesByInventory[batch.inventory_id] = [];
      }
      batchesByInventory[batch.inventory_id].push(batch);
    });

    // Enhance inventory items with batch pricing
    const enhancedInventory = inventory.map(item => {
      const batches = batchesByInventory[item.id] || [];
      const transformedItem = transformInventory(item);

      // Find the current active batch using FIFO logic
      const currentActiveBatch = batches.find(batch => {
        const remainingQuantity = (batch.quantity_remaining || 0);
        return remainingQuantity > 0 && batch.status === 'active';
      });

      // Calculate batch-based pricing
      let batchPricing = {
        currentCostPrice: item.cost,
        currentSellingPrice: item.base_price,
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

      const averageCostPrice = totalQuantityIn > 0 ? weightedCostSum / totalQuantityIn : item.cost;
      const averageSellingPrice = totalQuantityIn > 0 ? weightedSellingSum / totalQuantityIn : item.base_price;

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
        currentStockValue: (item.stock_quantity || 0) * batchPricing.currentCostPrice,
        expectedRevenue: (item.stock_quantity || 0) * batchPricing.currentSellingPrice,
        currentProfitMargin: batchPricing.currentCostPrice > 0 
          ? (((batchPricing.currentSellingPrice - batchPricing.currentCostPrice) / batchPricing.currentCostPrice) * 100).toFixed(1)
          : 0
      };
    });

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

    // Prepare category details based on category
    let categoryDetails = null;
    if (inventoryData.category === 'Food' && inventoryData.foodDetails) {
      categoryDetails = inventoryData.foodDetails;
    } else if (inventoryData.category === 'Beverages' && inventoryData.beveragesDetails) {
      categoryDetails = inventoryData.beveragesDetails;
    } else if (inventoryData.category === 'Books' && inventoryData.booksDetails) {
      categoryDetails = inventoryData.booksDetails;
    }

    // Create inventory item
    const { data: newItem, error: invError } = await supabaseAdmin
      .from('inventory')
      .insert({
        user_id: user.id,
        name: inventoryData.productName || inventoryData.name,
        description: inventoryData.description || '',
        category: inventoryData.category,
        category_details: categoryDetails,
        has_variants: inventoryData.hasVariants || (inventoryData.variants && inventoryData.variants.length > 0),
        base_price: inventoryData.sellingPrice || inventoryData.basePrice || 0,
        cost: inventoryData.costPrice || inventoryData.cost || 0,
        sku: inventoryData.sku || generateSKU(inventoryData.category, inventoryData.productName || inventoryData.name),
        barcode: inventoryData.barcode || null,
        stock_quantity: inventoryData.quantityInStock || inventoryData.stockQuantity || 0,
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

    // Variants live in the normalized inventory_variants table, not as a column on inventory
    if (Array.isArray(inventoryData.variants) && inventoryData.variants.length > 0) {
      const variantRows = inventoryData.variants.map(v => ({
        inventory_id: newItem.id,
        size: v.size || 'One Size',
        color: v.color,
        sku: v.sku || null,
        quantity_in_stock: v.quantityInStock || 0,
        reorder_level: v.reorderLevel || 5,
        images: v.images || []
      }));

      const { error: variantsError } = await supabaseAdmin
        .from('inventory_variants')
        .insert(variantRows);

      if (variantsError) {
        console.error('Variant creation error:', variantsError);
        // Don't fail the entire operation if variant creation fails
      }
    }

    // Generate batch code
    const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const productCode = inventoryData.sku ? inventoryData.sku.split('-')[0] : 'PRD';
    const batchCode = `${productCode}-${dateCode}-B001`;

    // Create initial batch
    const { data: firstBatch, error: batchError } = await supabaseAdmin
      .from('inventory_batches')
      .insert({
        user_id: user.id,
        inventory_id: newItem.id,
        batch_code: batchCode,
        quantity_in: inventoryData.quantityInStock || 0,
        quantity_sold: 0,
        quantity_remaining: inventoryData.quantityInStock || 0,
        cost_price: inventoryData.costPrice || inventoryData.cost || 0,
        selling_price: inventoryData.sellingPrice || inventoryData.basePrice || 0,
        date_received: new Date().toISOString(),
        supplier: inventoryData.supplier || '',
        notes: 'Initial stock batch - created with product',
        status: 'active',
        batch_location: inventoryData.location || 'Main Store'
      })
      .select()
      .single();

    if (batchError) {
      console.error('Batch creation error:', batchError);
      // Don't fail the entire operation if batch creation fails
    }

    // Track activity
    try {
      await supabaseAdmin
        .from('inventory_activities')
        .insert({
          user_id: user.id,
          inventory_id: newItem.id,
          activity_type: 'created',
          quantity_before: 0,
          quantity_changed: inventoryData.quantityInStock || 0,
          quantity_after: inventoryData.quantityInStock || 0,
          reason: `Created new inventory item: ${newItem.name}`,
          batch_id: firstBatch?.id,
          batch_code: firstBatch?.batch_code,
          metadata: {
            initialBatchId: firstBatch?.id,
            initialBatchCode: firstBatch?.batch_code
          }
        });
    } catch (activityError) {
      console.error('Activity tracking error:', activityError);
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory item and initial batch created successfully',
      data: {
        inventory: transformInventory(newItem),
        initialBatch: firstBatch ? {
          _id: firstBatch.id,
          id: firstBatch.id,
          batchCode: firstBatch.batch_code,
          totalQuantity: firstBatch.quantity_in
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
