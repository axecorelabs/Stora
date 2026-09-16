import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCommerceApiAccess } from '@/lib/storeAccess';
import { backfillMissingSkus } from '@/lib/inventorySku';
import { backfillMissingStoreIds } from '@/lib/inventoryStoreId';
import { embedProductById } from '@/lib/openrouter';
import { normalizeExtraDefinitions } from '@stora/shared-constants';

// Helper to transform inventory data for response. Every product has >=1
// real inventory_variants row now -- stock/price are always derived from
// those, never a flat column on `inventory`. hasVariants is derived (more
// than one row), not a stored flag.
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
    _id: v.id,
    id: v.id,
    size: v.size,
    color: v.color,
    sku: v.sku,
    quantityInStock: v.quantity_in_stock,
    reservedQuantity: v.reserved_quantity,
    reorderLevel: v.reorder_level,
    soldQuantity: v.sold_quantity,
    images: v.images || [],
    barcode: v.barcode,
    isActive: v.is_active,
    price: v.price,
    costPrice: v.cost_price
  }));

  const totalStock = variants.reduce((sum, v) => sum + (v.quantity_in_stock || 0), 0);
  const totalReserved = variants.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0);
  const totalSold = variants.reduce((sum, v) => sum + (v.sold_quantity || 0), 0);
  const representativePrice = variants[0]?.price ?? 0;
  const representativeCost = variants[0]?.cost_price ?? 0;

  return {
    id: item.id,
    _id: item.id,
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
    image: primaryImage,
    primaryImage: primaryImage,
    tags: typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : item.tags || [],
    isActive: item.is_active,
    status: item.is_active ? 'Active' : 'Inactive',
    // Nullable, default true at the DB level -- `!== false` treats an
    // unset legacy row the same as an explicit true. See the matching fix
    // in ../route.js's own transformInventory for why this must be here:
    // without it, a hidden item looks visible again on every reload.
    webVisibility: item.web_visibility !== false,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

async function fetchVariants(inventoryId, { activeOnly = true } = {}) {
  let query = supabaseAdmin.from('inventory_variants').select('*').eq('inventory_id', inventoryId);
  if (activeOnly) query = query.eq('is_active', true);
  const { data } = await query.order('color', { ascending: true }).order('size', { ascending: true });
  return data || [];
}

function toNonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

// GET - Fetch specific inventory item
export async function GET(req, { params }) {
  try {
    const access = await requireCommerceApiAccess(req);
    if (!access.ok) {
      return access.response;
    }
    const { user } = access;

    const { id } = await params;

    const { data: item, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !item) {
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Backfill SKU and store_id if this item predates those being set
    await backfillMissingSkus([item]);
    await backfillMissingStoreIds([item], user.id);

    // Always fetch variants now -- no has_variants gate, every product has
    // at least one (its "default" variant if it has no real size/color
    // options).
    const variants = await fetchVariants(id);

    return NextResponse.json({
      success: true,
      data: transformInventory(item, variants)
    });

  } catch (error) {
    console.error('Inventory item fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update specific inventory item
export async function PUT(request, { params }) {
  try {
    const access = await requireCommerceApiAccess(request);
    if (!access.ok) {
      return access.response;
    }
    const { user } = access;

    const { id } = await params;
    const updateData = await request.json();

    // Build update object with snake_case keys -- listing metadata only.
    // has_variants/base_price/cost/stock_quantity are not columns this
    // route writes to anymore: hasVariants is derived from variant count,
    // price/cost live on inventory_variants (updated below), and stock
    // only ever changes through the batch RPCs.
    const dbUpdate = {
      updated_at: new Date().toISOString()
    };

    if (updateData.productName || updateData.name) {
      dbUpdate.name = updateData.productName || updateData.name;
    }
    if (updateData.description !== undefined) {
      dbUpdate.description = updateData.description;
    }
    if (updateData.brand !== undefined) {
      dbUpdate.brand = updateData.brand;
    }
    if (updateData.unitOfMeasure !== undefined) {
      dbUpdate.unit_of_measure = updateData.unitOfMeasure;
    }
    if (updateData.supplier !== undefined) {
      dbUpdate.supplier = updateData.supplier;
    }
    if (updateData.location !== undefined) {
      dbUpdate.location = updateData.location;
    }
    if (updateData.category) {
      dbUpdate.category = updateData.category;
    }
    // The edit form (EditInventoryModal.js) sends the flat per-category
    // objects it also uses internally (foodDetails, beveragesDetails,
    // booksDetails), the same shape the add flow sends -- not a pre-wrapped
    // `categoryDetails`, which nothing actually ever sends. Nest it the
    // same way POST does (see /api/inventory/route.js) so it lands under
    // category_details.food, matching what the storefront reads.
    if (updateData.categoryDetails) {
      dbUpdate.category_details = updateData.categoryDetails;
      // Extras carry real money now -- clamp/normalize regardless of which
      // shape this update arrived in, not just the foodDetails branch below.
      if (dbUpdate.category_details.food?.extras) {
        dbUpdate.category_details = {
          ...dbUpdate.category_details,
          food: { ...dbUpdate.category_details.food, extras: normalizeExtraDefinitions(dbUpdate.category_details.food.extras) }
        };
      }
    } else if (updateData.category === 'Food' && updateData.foodDetails) {
      dbUpdate.category_details = {
        food: { ...updateData.foodDetails, extras: normalizeExtraDefinitions(updateData.foodDetails.extras) }
      };
    } else if (updateData.category === 'Beverages' && updateData.beveragesDetails) {
      dbUpdate.category_details = { beverages: updateData.beveragesDetails };
    } else if (updateData.category === 'Books' && updateData.booksDetails) {
      dbUpdate.category_details = { books: updateData.booksDetails };
    }

    // Same "made to order" validation as the create route (see
    // 20260915000000_made_to_order_menu_items.sql) -- read from whichever
    // shape the food details arrived in, matching the categoryDetails
    // handling just above.
    const editedFoodDetails = dbUpdate.category_details?.food ?? (updateData.category === 'Food' ? updateData.foodDetails : null);
    const isMadeToOrder = !!editedFoodDetails?.madeToOrder;
    const maxOrdersPerDay = isMadeToOrder ? parseInt(editedFoodDetails?.maxOrdersPerDay, 10) : null;
    if (isMadeToOrder && (!Number.isFinite(maxOrdersPerDay) || maxOrdersPerDay <= 0)) {
      return NextResponse.json(
        { success: false, message: 'Set how many orders per day this made-to-order item can take' },
        { status: 400 }
      );
    }
    // undefined (not touched) unless this update actually carries food
    // details -- an edit to an unrelated field (name, images, tags) must
    // not silently flip an existing item's unlimited flag back off.
    const touchesMadeToOrder = editedFoodDetails !== null && editedFoodDetails !== undefined;

    if (updateData.sku) {
      dbUpdate.sku = updateData.sku;
    }
    if (updateData.barcode !== undefined) {
      dbUpdate.barcode = updateData.barcode;
    }
    if (updateData.minimumStock !== undefined || updateData.reorderLevel !== undefined) {
      dbUpdate.minimum_stock = updateData.minimumStock ?? updateData.reorderLevel;
    }
    if (updateData.images) {
      dbUpdate.images = updateData.images;
    }
    if (updateData.tags) {
      dbUpdate.tags = updateData.tags;
    }
    if (updateData.isActive !== undefined) {
      dbUpdate.is_active = updateData.isActive;
    }

    // Atomic write path: inventory row + related variants in one DB
    // transaction via RPC, so this endpoint cannot persist partial success.
    const applyPriceUpdate =
      updateData.sellingPrice !== undefined ||
      updateData.basePrice !== undefined ||
      updateData.costPrice !== undefined ||
      updateData.cost !== undefined;
    const nextPrice = applyPriceUpdate ? (updateData.sellingPrice ?? updateData.basePrice ?? null) : null;
    const nextCostPrice = applyPriceUpdate ? (updateData.costPrice ?? updateData.cost ?? null) : null;
    const productReorderLevel = toNonNegativeNumber(updateData.minimumStock ?? updateData.reorderLevel);
    const variantsPayload = Array.isArray(updateData.variants) && updateData.variants.length > 0
      ? updateData.variants
      : null;
    const applyPassiveUpdate = !variantsPayload && (touchesMadeToOrder || productReorderLevel !== null);

    const { error: writeError } = await supabaseAdmin.rpc('fn_update_inventory_item_atomic', {
      p_inventory_id: id,
      p_user_id: user.id,
      p_inventory_patch: dbUpdate,
      p_apply_price_update: applyPriceUpdate,
      p_price: nextPrice,
      p_cost_price: nextCostPrice,
      p_variants: variantsPayload,
      p_apply_passive_update: applyPassiveUpdate,
      p_passive_reorder_level: productReorderLevel,
      p_touches_made_to_order: touchesMadeToOrder,
      p_is_made_to_order: isMadeToOrder,
      p_max_orders_per_day: maxOrdersPerDay
    });

    if (writeError) {
      console.error('Inventory atomic update error:', writeError);
      const notFound = (writeError.message || '').toLowerCase().includes('not found');
      return NextResponse.json(
        { success: false, message: notFound ? 'Item not found' : 'Failed to update inventory item' },
        { status: notFound ? 404 : 500 }
      );
    }

    const { data: item, error: refetchError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (refetchError || !item) {
      console.error('Inventory refetch after update error:', refetchError);
      return NextResponse.json(
        { success: false, message: 'Item not found' },
        { status: 404 }
      );
    }

    // Only re-embed when the text an AI-search match is actually judged
    // against changed -- a stock/price/variant-only edit doesn't need a
    // new OpenRouter round trip. Deferred, same as the create route.
    if (dbUpdate.name !== undefined || dbUpdate.description !== undefined || dbUpdate.category !== undefined) {
      after(() => embedProductById(id));
    }

    const finalVariants = await fetchVariants(id);
    return NextResponse.json({
      success: true,
      data: transformInventory(item, finalVariants)
    });

  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update inventory item' },
      { status: 500 }
    );
  }
}

// DELETE - Delete specific inventory item
export async function DELETE(req, { params }) {
  try {
    const access = await requireCommerceApiAccess(req);
    if (!access.ok) {
      return access.response;
    }
    const { user } = access;

    const { id } = await params;

    // Delete the inventory item
    const { error } = await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Inventory delete error:', error);
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });

  } catch (error) {
    console.error('Inventory item delete error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
