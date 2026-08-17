import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// Helper to transform batch data
function transformBatch(batch) {
  if (!batch) return null;
  return {
    id: batch.id,
    _id: batch.id,
    batchCode: batch.batch_code,
    quantityIn: batch.quantity_in,
    quantitySold: batch.quantity_sold,
    quantityRemaining: batch.quantity_remaining,
    costPrice: batch.cost_price,
    sellingPrice: batch.selling_price,
    dateReceived: batch.date_received,
    supplier: batch.supplier,
    notes: batch.notes,
    status: batch.status,
    batchLocation: batch.batch_location
  };
}

export async function PUT(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id: inventoryId } = await params;
    const { type, quantity, reason, batchId, createNewBatch, variantId } = await req.json();

    // Validate input
    if (!type || !quantity || !reason) {
      return NextResponse.json(
        { success: false, message: 'Type, quantity, and reason are required' },
        { status: 400 }
      );
    }

    if (!['add', 'subtract'].includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Type must be add or subtract' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { success: false, message: 'Quantity must be greater than 0' },
        { status: 400 }
      );
    }

    // Find the inventory item
    const { data: inventory, error: invError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', inventoryId)
      .eq('user_id', user.id)
      .single();

    if (invError || !inventory) {
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Every product has >=1 real variant now -- stock is always variant-
    // scoped. If the caller (StockUpdateModal.js) didn't specify which
    // variant, that's only unambiguous when the product has exactly one.
    let targetVariant;
    if (variantId) {
      const { data: v } = await supabaseAdmin
        .from('inventory_variants')
        .select('*')
        .eq('id', variantId)
        .eq('inventory_id', inventoryId)
        .single();
      if (!v) {
        return NextResponse.json({ success: false, message: 'Variant not found' }, { status: 404 });
      }
      targetVariant = v;
    } else {
      const { data: variants } = await supabaseAdmin
        .from('inventory_variants')
        .select('*')
        .eq('inventory_id', inventoryId)
        .eq('is_active', true);
      if (!variants || variants.length !== 1) {
        return NextResponse.json(
          { success: false, message: variants?.length > 1 ? 'This product has multiple variants -- specify which one' : 'This product has no variant to adjust' },
          { status: 400 }
        );
      }
      targetVariant = variants[0];
    }

    const previousStock = targetVariant.quantity_in_stock || 0;

    // Both branches now go through fn_create_batch/fn_add_to_batch/
    // fn_remove_stock (20260817000002_variant_only_rpcs.sql) -- one
    // locked transaction each instead of the three separate
    // unsynchronized round trips (read stock, write batch, write stock)
    // this route used to make.
    if (type === 'add') {
      if (createNewBatch || !batchId) {
        const productCode = inventory.sku ? inventory.sku.split('-')[0] : 'PRD';
        const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const { count } = await supabaseAdmin
          .from('inventory_batches')
          .select('*', { count: 'exact', head: true })
          .eq('inventory_id', inventoryId);
        const batchSequence = String((count || 0) + 1).padStart(3, '0');
        const batchCode = `${productCode}-${dateCode}-B${batchSequence}`;

        const { data: rpcResult, error: batchError } = await supabaseAdmin.rpc('fn_create_batch', {
          p_variant_id: targetVariant.id,
          p_user_id: user.id,
          p_batch_code: batchCode,
          p_quantity_in: quantity,
          p_cost_price: targetVariant.cost_price || 0,
          p_selling_price: targetVariant.price || 0,
          p_notes: `Stock added: ${reason}`,
          p_reason: reason
        });

        if (batchError) {
          console.error('Batch creation error:', batchError);
          return NextResponse.json({ success: false, message: 'Failed to create batch' }, { status: 500 });
        }

        const result = rpcResult?.[0];
        const { data: createdBatch } = await supabaseAdmin.from('inventory_batches').select('*').eq('id', result.batch_id).single();

        return NextResponse.json({
          success: true,
          message: 'Stock added successfully',
          data: {
            inventory: { _id: inventoryId, id: inventoryId, variantId: targetVariant.id, quantityInStock: result.new_stock_quantity, stockQuantity: result.new_stock_quantity },
            batch: transformBatch(createdBatch),
            affectedBatches: [],
            stockChange: { type, quantity, previousStock, newStock: result.new_stock_quantity }
          }
        });
      } else {
        const { data: rpcResult, error: addError } = await supabaseAdmin.rpc('fn_add_to_batch', {
          p_batch_id: batchId,
          p_quantity: quantity,
          p_user_id: user.id,
          p_reason: reason
        });

        if (addError) {
          console.error('Add to batch error:', addError);
          return NextResponse.json({ success: false, message: addError.message || 'Failed to update batch' }, { status: 500 });
        }

        const result = rpcResult?.[0];
        const { data: updatedBatchData } = await supabaseAdmin.from('inventory_batches').select('*').eq('id', batchId).single();

        return NextResponse.json({
          success: true,
          message: 'Stock added successfully',
          data: {
            inventory: { _id: inventoryId, id: inventoryId, variantId: targetVariant.id, quantityInStock: result.new_stock_quantity, stockQuantity: result.new_stock_quantity },
            batch: transformBatch(updatedBatchData),
            affectedBatches: [],
            stockChange: { type, quantity, previousStock, newStock: result.new_stock_quantity }
          }
        });
      }
    } else if (type === 'subtract') {
      // fn_remove_stock is a correction/write-off, not a sale -- it
      // deliberately does not touch quantity_sold (the previous
      // hand-written version of this route booked manual removals as if
      // sold, inflating sold-quantity/profit metrics with stock that was
      // actually lost to damage, loss, or a recount).
      const { data: rpcResult, error: removeError } = await supabaseAdmin.rpc('fn_remove_stock', {
        p_variant_id: targetVariant.id,
        p_batch_id: batchId || null,
        p_quantity: quantity,
        p_user_id: user.id,
        p_reason: reason
      });

      if (removeError) {
        console.error('Remove stock error:', removeError);
        return NextResponse.json({ success: false, message: removeError.message || 'Failed to remove stock' }, { status: 500 });
      }

      const result = rpcResult?.[0];
      if (!result?.success) {
        return NextResponse.json(
          { success: false, message: `Cannot remove more stock than available (${result?.shortfall ?? quantity} short)` },
          { status: 400 }
        );
      }

      const newStockQuantity = previousStock - quantity;
      const affectedBatches = (result.batches || []).map(b => ({
        batchId: b.batch_id,
        batchCode: b.batch_code,
        quantityRemoved: b.quantity
      }));

      return NextResponse.json({
        success: true,
        message: 'Stock removed successfully',
        data: {
          inventory: { _id: inventoryId, id: inventoryId, variantId: targetVariant.id, quantityInStock: newStockQuantity, stockQuantity: newStockQuantity },
          batch: affectedBatches,
          affectedBatches,
          stockChange: { type, quantity, previousStock, newStock: newStockQuantity }
        }
      });
    }

  } catch (error) {
    console.error('Stock update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
