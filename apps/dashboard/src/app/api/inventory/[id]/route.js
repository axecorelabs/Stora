import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { backfillMissingSkus } from '@/lib/inventorySku';
import { backfillMissingStoreIds } from '@/lib/inventoryStoreId';
import { embedProductById } from '@/lib/openrouter';

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

// GET - Fetch specific inventory item
export async function GET(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

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
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

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
    } else if (updateData.category === 'Food' && updateData.foodDetails) {
      dbUpdate.category_details = { food: updateData.foodDetails };
    } else if (updateData.category === 'Beverages' && updateData.beveragesDetails) {
      dbUpdate.category_details = { beverages: updateData.beveragesDetails };
    } else if (updateData.category === 'Books' && updateData.booksDetails) {
      dbUpdate.category_details = { books: updateData.booksDetails };
    }
    if (updateData.sku) {
      dbUpdate.sku = updateData.sku;
    }
    if (updateData.barcode !== undefined) {
      dbUpdate.barcode = updateData.barcode;
    }
    if (updateData.minimumStock !== undefined || updateData.reorderLevel !== undefined) {
      dbUpdate.minimum_stock = updateData.minimumStock || updateData.reorderLevel;
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

    const { data: item, error } = await supabaseAdmin
      .from('inventory')
      .update(dbUpdate)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Inventory update error:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, message: 'Item not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, message: 'Failed to update inventory item' },
        { status: 500 }
      );
    }

    // No per-variant pricing UI exists yet -- a price/cost edit here
    // applies to every variant of this product uniformly, matching the
    // single-price form the vendor actually filled in.
    if (updateData.sellingPrice !== undefined || updateData.basePrice !== undefined || updateData.costPrice !== undefined || updateData.cost !== undefined) {
      const priceUpdate = { updated_at: new Date().toISOString() };
      if (updateData.sellingPrice !== undefined || updateData.basePrice !== undefined) {
        priceUpdate.price = updateData.sellingPrice ?? updateData.basePrice;
      }
      if (updateData.costPrice !== undefined || updateData.cost !== undefined) {
        priceUpdate.cost_price = updateData.costPrice ?? updateData.cost;
      }
      const { error: priceError } = await supabaseAdmin
        .from('inventory_variants')
        .update(priceUpdate)
        .eq('inventory_id', id);
      if (priceError) console.error('Variant price update error:', priceError);
    }

    // Reconcile variant rows (size/color/reorder_level/sku/images) against
    // the submitted list -- NOT a delete-and-reinsert. inventory_batches
    // references variants with ON DELETE SET NULL, and an active batch is
    // required to have a variant_id (see the CHECK constraint added in
    // 20260817000001_unify_inventory_variants.sql), so hard-deleting a
    // variant that still has active batches would break that invariant.
    // Matched by id when the client sent one (existing variant, editable
    // fields only -- quantity/price are not touched here, those come from
    // Add Batch/Adjust Stock and the price block above respectively);
    // unmatched incoming rows are new variants (start at 0 stock, same as
    // a brand-new product does, until stock is actually added to them);
    // existing variants missing from the payload are soft-removed
    // (is_active: false) rather than deleted, preserving their batch
    // history and FK integrity.
    if (updateData.variants) {
      const existingVariants = await fetchVariants(id, { activeOnly: false });
      const incoming = updateData.variants;
      const incomingIds = new Set(incoming.map(v => v.id || v._id).filter(Boolean));

      for (const v of incoming) {
        const variantId = v.id || v._id;
        if (variantId && existingVariants.some(ev => ev.id === variantId)) {
          const { error: updErr } = await supabaseAdmin
            .from('inventory_variants')
            .update({
              size: v.size || 'One Size',
              color: v.color || 'Default',
              sku: v.sku || null,
              reorder_level: v.reorderLevel || 5,
              images: v.images || [],
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', variantId)
            .eq('inventory_id', id);
          if (updErr) console.error('Variant update error:', updErr);
        } else {
          const { error: insErr } = await supabaseAdmin
            .from('inventory_variants')
            .insert({
              inventory_id: id,
              size: v.size || 'One Size',
              color: v.color || 'Default',
              sku: v.sku || null,
              quantity_in_stock: 0,
              reorder_level: v.reorderLevel || 5,
              price: updateData.sellingPrice ?? updateData.basePrice ?? existingVariants[0]?.price ?? 0,
              cost_price: updateData.costPrice ?? updateData.cost ?? existingVariants[0]?.cost_price ?? 0,
              images: v.images || [],
              is_active: true
            });
          if (insErr) console.error('Variant creation error:', insErr);
        }
      }

      const toDeactivate = existingVariants.filter(ev => ev.is_active && !incomingIds.has(ev.id));
      if (toDeactivate.length > 0) {
        const { error: deactErr } = await supabaseAdmin
          .from('inventory_variants')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('id', toDeactivate.map(v => v.id));
        if (deactErr) console.error('Variant deactivation error:', deactErr);
      }
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
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

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
