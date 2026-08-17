import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

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

// GET - Get all batches for a specific inventory item
export async function GET(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id: productId } = await params;
    const { searchParams } = new URL(req.url);
    
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'date_received';
    const sortOrder = searchParams.get('sortOrder') === '1';
    const latest = searchParams.get('latest') === 'true';
    const active = searchParams.get('active') === 'true';

    // Verify the inventory item belongs to the user
    const { data: inventory, error: invError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single();

    if (invError || !inventory) {
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // If active=true, return the current active batch (FIFO - oldest active batch with stock)
    if (active) {
      const { data: activeBatch } = await supabaseAdmin
        .from('inventory_batches')
        .select('*')
        .eq('inventory_id', productId)
        .eq('status', 'active')
        .gt('quantity_remaining', 0)
        .order('date_received', { ascending: true })
        .limit(1)
        .single();

      return NextResponse.json({
        success: true,
        batches: activeBatch ? [transformBatch(activeBatch)] : []
      });
    }

    // If latest=true, return only the most recent batch
    if (latest) {
      const { data: latestBatch } = await supabaseAdmin
        .from('inventory_batches')
        .select('*')
        .eq('inventory_id', productId)
        .order('date_received', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        success: true,
        batches: latestBatch ? [transformBatch(latestBatch)] : []
      });
    }

    // Build query for all batches
    let query = supabaseAdmin
      .from('inventory_batches')
      .select('*')
      .eq('inventory_id', productId);

    if (status) {
      query = query.eq('status', status);
    }

    // Map sort field names
    const sortFieldMap = {
      'dateReceived': 'date_received',
      'costPrice': 'cost_price',
      'sellingPrice': 'selling_price',
      'quantityRemaining': 'quantity_remaining',
      'createdAt': 'created_at'
    };
    const sortField = sortFieldMap[sortBy] || sortBy;
    
    query = query.order(sortField, { ascending: sortOrder });

    const { data: batches, error: batchError } = await query;

    if (batchError) {
      console.error('Batch fetch error:', batchError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch batches' },
        { status: 500 }
      );
    }

    // Calculate batch statistics
    const batchList = batches || [];
    const stats = {
      totalBatches: batchList.length,
      activeBatches: batchList.filter(b => b.status === 'active').length,
      totalQuantityRemaining: batchList.reduce((sum, b) => sum + (b.quantity_remaining || 0), 0),
      totalBatchValue: batchList.reduce((sum, b) => sum + ((b.quantity_remaining || 0) * (b.cost_price || 0)), 0),
      averageCostPrice: batchList.length > 0 
        ? batchList.reduce((sum, b) => sum + (b.cost_price || 0), 0) / batchList.length 
        : 0,
      oldestBatch: batchList.length > 0 
        ? batchList.reduce((oldest, b) => new Date(b.date_received) < new Date(oldest) ? b.date_received : oldest, batchList[0].date_received)
        : null,
      newestBatch: batchList.length > 0
        ? batchList.reduce((newest, b) => new Date(b.date_received) > new Date(newest) ? b.date_received : newest, batchList[0].date_received)
        : null
    };

    return NextResponse.json({
      success: true,
      data: {
        batches: batchList.map(transformBatch),
        stats,
        inventory: {
          _id: inventory.id,
          id: inventory.id,
          productName: inventory.name,
          sku: inventory.sku,
          category: inventory.category
        }
      }
    });

  } catch (error) {
    console.error('Batch fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Add a new batch for an inventory item
export async function POST(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id: productId } = await params;
    const batchData = await req.json();

    // Verify the inventory item belongs to the user
    const { data: inventory, error: invError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single();

    if (invError || !inventory) {
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    const productCode = inventory.sku ? inventory.sku.split('-')[0] : 'PRD';
    const dateReceived = batchData.dateReceived ? new Date(batchData.dateReceived) : new Date();
    const dateCode = dateReceived.toISOString().slice(2, 10).replace(/-/g, '');
    const { count: existingBatchCount } = await supabaseAdmin
      .from('inventory_batches')
      .select('*', { count: 'exact', head: true })
      .eq('inventory_id', productId);

    // Every batch is variant-scoped now. AddBatchModal.js sends a
    // `variants` array (one entry per size/color) for a multi-variant
    // product -- previously silently ignored (this route only ever read
    // the singular `variantId`, so a per-variant batch submission ended up
    // crediting the product as a whole instead of the right variants).
    // Now actually consumed: one fn_create_batch call per entry.
    let targetVariants;
    if (Array.isArray(batchData.variants) && batchData.variants.length > 0) {
      targetVariants = batchData.variants.map(v => ({
        variantId: v.variantId,
        quantityIn: v.quantityIn,
        costPrice: v.costPrice ?? batchData.costPrice,
        sellingPrice: v.sellingPrice ?? batchData.sellingPrice
      }));
    } else if (batchData.variantId) {
      targetVariants = [{ variantId: batchData.variantId, quantityIn: batchData.quantityIn, costPrice: batchData.costPrice, sellingPrice: batchData.sellingPrice }];
    } else {
      // No variant specified -- only valid when the product has exactly
      // one (its "default" variant). A real multi-variant product must
      // say which variant(s) via the array above.
      const { data: variants } = await supabaseAdmin
        .from('inventory_variants')
        .select('id')
        .eq('inventory_id', productId)
        .eq('is_active', true);
      if (!variants || variants.length !== 1) {
        return NextResponse.json(
          { success: false, message: variants?.length > 1 ? 'This product has multiple variants -- specify which one(s) to add stock to' : 'This product has no variant to add stock to' },
          { status: 400 }
        );
      }
      targetVariants = [{ variantId: variants[0].id, quantityIn: batchData.quantityIn, costPrice: batchData.costPrice, sellingPrice: batchData.sellingPrice }];
    }

    const createdBatches = [];
    for (let i = 0; i < targetVariants.length; i++) {
      const v = targetVariants[i];
      const batchCode = batchData.batchCode && targetVariants.length === 1
        ? batchData.batchCode
        : `${productCode}-${dateCode}-B${String((existingBatchCount || 0) + i + 1).padStart(3, '0')}`;

      // fn_create_batch inserts the batch and bumps the variant's
      // quantity_in_stock in one locked transaction -- see
      // 20260817000002_variant_only_rpcs.sql.
      const { data: rpcResult, error: batchError } = await supabaseAdmin.rpc('fn_create_batch', {
        p_variant_id: v.variantId,
        p_user_id: user.id,
        p_batch_code: batchCode,
        p_quantity_in: v.quantityIn,
        p_cost_price: v.costPrice,
        p_selling_price: v.sellingPrice,
        p_supplier: batchData.supplier || '',
        p_notes: batchData.notes || '',
        p_batch_location: batchData.batchLocation || 'Main Store',
        p_date_received: batchData.dateReceived || new Date().toISOString(),
        p_expiry_date: batchData.expiryDate || null,
        p_reason: `Added new batch: ${batchCode}`
      });

      if (batchError) {
        console.error(`Batch creation error for variant ${v.variantId}:`, batchError);
        return NextResponse.json(
          { success: false, message: `Failed to create batch${targetVariants.length > 1 ? ` (variant ${i + 1} of ${targetVariants.length})` : ''}`, createdSoFar: createdBatches.length },
          { status: 500 }
        );
      }

      const result = rpcResult?.[0];
      const { data: newBatch } = await supabaseAdmin.from('inventory_batches').select('*').eq('id', result.batch_id).single();
      createdBatches.push({ batch: transformBatch(newBatch), variantId: v.variantId, newVariantStock: result.new_stock_quantity });
    }

    return NextResponse.json({
      success: true,
      message: createdBatches.length > 1 ? `${createdBatches.length} batches added successfully` : 'Batch added successfully',
      data: {
        batch: createdBatches[0].batch,
        batches: createdBatches.map(b => b.batch),
        updatedInventory: {
          id: productId,
          _id: productId
        }
      }
    });

  } catch (error) {
    console.error('Batch creation error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update batch fields (prices, supplier, location, etc.)
export async function PATCH(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id: productId } = await params;
    const body = await req.json();
    const { batchId, costPrice, sellingPrice, supplier, batchLocation, expiryDate, notes } = body;

    // Verify the inventory item belongs to the user
    const { data: inventory, error: invError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single();

    if (invError || !inventory) {
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData = { updated_at: new Date().toISOString() };
    const updatedFields = [];

    if (costPrice !== undefined && costPrice >= 0) {
      updateData.cost_price = costPrice;
      updatedFields.push('costPrice');
    }
    if (sellingPrice !== undefined && sellingPrice >= 0) {
      updateData.selling_price = sellingPrice;
      updatedFields.push('sellingPrice');
    }
    if (supplier !== undefined) {
      updateData.supplier = supplier;
      updatedFields.push('supplier');
    }
    if (batchLocation !== undefined) {
      updateData.batch_location = batchLocation;
      updatedFields.push('batchLocation');
    }
    if (expiryDate !== undefined) {
      updateData.expiry_date = expiryDate;
      updatedFields.push('expiryDate');
    }
    if (notes !== undefined) {
      updateData.notes = notes;
      updatedFields.push('notes');
    }

    const { data: batch, error: updateError } = await supabaseAdmin
      .from('inventory_batches')
      .update(updateData)
      .eq('id', batchId)
      .eq('inventory_id', productId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !batch) {
      return NextResponse.json(
        { success: false, message: 'Batch not found' },
        { status: 404 }
      );
    }

    // Track activity
    try {
      await supabaseAdmin
        .from('inventory_activities')
        .insert({
          user_id: user.id,
          inventory_id: productId,
          activity_type: 'batch_update',
          quantity_before: batch.quantity_remaining,
          quantity_changed: 0,
          quantity_after: batch.quantity_remaining,
          reason: `Updated batch: ${batch.batch_code} (${updatedFields.join(', ')})`,
          batch_id: batch.id,
          batch_code: batch.batch_code,
          metadata: {
            updatedFields,
            newCostPrice: costPrice,
            newSellingPrice: sellingPrice
          }
        });
    } catch (activityError) {
      console.error('Activity tracking failed:', activityError);
    }

    return NextResponse.json({
      success: true,
      message: 'Batch updated successfully',
      data: {
        batch: transformBatch(batch),
        updatedFields
      }
    });

  } catch (error) {
    console.error('Batch update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
