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
    const { type, quantity, reason, batchId, createNewBatch } = await req.json();

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

    const previousStock = inventory.stock_quantity || 0;
    let updatedBatch = null;
    let newBatch = null;
    let affectedBatches = [];

    if (type === 'add') {
      // Adding stock
      if (createNewBatch || !batchId) {
        // Create new batch
        const productCode = inventory.sku ? inventory.sku.split('-')[0] : 'PRD';
        const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        
        // Count existing batches
        const { count } = await supabaseAdmin
          .from('inventory_batches')
          .select('*', { count: 'exact', head: true })
          .eq('inventory_id', inventoryId);
        
        const batchSequence = String((count || 0) + 1).padStart(3, '0');
        const batchCode = `${productCode}-${dateCode}-B${batchSequence}`;

        const { data: createdBatch, error: batchError } = await supabaseAdmin
          .from('inventory_batches')
          .insert({
            user_id: user.id,
            inventory_id: inventoryId,
            batch_code: batchCode,
            quantity_in: quantity,
            quantity_sold: 0,
            quantity_remaining: quantity,
            cost_price: inventory.cost || 0,
            selling_price: inventory.base_price || 0,
            date_received: new Date().toISOString(),
            supplier: '',
            notes: `Stock added: ${reason}`,
            status: 'active',
            batch_location: 'Main Store'
          })
          .select()
          .single();

        if (batchError) {
          console.error('Batch creation error:', batchError);
          return NextResponse.json(
            { success: false, message: 'Failed to create batch' },
            { status: 500 }
          );
        }

        newBatch = createdBatch;
        updatedBatch = transformBatch(createdBatch);
      } else {
        // Add to existing batch
        const { data: batch, error: batchFetchError } = await supabaseAdmin
          .from('inventory_batches')
          .select('*')
          .eq('id', batchId)
          .eq('user_id', user.id)
          .eq('inventory_id', inventoryId)
          .single();

        if (batchFetchError || !batch) {
          return NextResponse.json(
            { success: false, message: 'Batch not found' },
            { status: 404 }
          );
        }

        // Update batch quantities
        const newNotes = batch.notes 
          ? `${batch.notes}\nAdded: ${reason} (+${quantity})` 
          : `Added: ${reason} (+${quantity})`;

        const { data: updatedBatchData, error: updateError } = await supabaseAdmin
          .from('inventory_batches')
          .update({
            quantity_in: batch.quantity_in + quantity,
            quantity_remaining: batch.quantity_remaining + quantity,
            notes: newNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', batchId)
          .select()
          .single();

        if (updateError) {
          console.error('Batch update error:', updateError);
          return NextResponse.json(
            { success: false, message: 'Failed to update batch' },
            { status: 500 }
          );
        }

        updatedBatch = transformBatch(updatedBatchData);
      }

      // Update inventory totals
      const { data: updatedInventory, error: invUpdateError } = await supabaseAdmin
        .from('inventory')
        .update({
          stock_quantity: previousStock + quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryId)
        .select()
        .single();

      if (invUpdateError) {
        console.error('Inventory update error:', invUpdateError);
      }

      // Track activity
      try {
        await supabaseAdmin
          .from('inventory_activities')
          .insert({
            user_id: user.id,
            inventory_id: inventoryId,
            activity_type: 'stock_added',
            quantity_before: previousStock,
            quantity_changed: quantity,
            quantity_after: previousStock + quantity,
            reason: reason,
            batch_id: newBatch?.id || batchId,
            batch_code: newBatch?.batch_code || updatedBatch?.batchCode,
            metadata: {
              batchType: createNewBatch ? 'new' : 'existing'
            }
          });
      } catch (activityError) {
        console.error('Activity tracking failed:', activityError);
      }

      return NextResponse.json({
        success: true,
        message: 'Stock added successfully',
        data: {
          inventory: {
            _id: inventoryId,
            id: inventoryId,
            quantityInStock: previousStock + quantity,
            stockQuantity: previousStock + quantity
          },
          batch: updatedBatch,
          affectedBatches: [],
          stockChange: {
            type,
            quantity,
            previousStock,
            newStock: previousStock + quantity
          }
        }
      });

    } else if (type === 'subtract') {
      // Subtracting stock
      if (quantity > previousStock) {
        return NextResponse.json(
          { success: false, message: 'Cannot remove more stock than available' },
          { status: 400 }
        );
      }

      if (batchId) {
        // Remove from specific batch
        const { data: batch, error: batchFetchError } = await supabaseAdmin
          .from('inventory_batches')
          .select('*')
          .eq('id', batchId)
          .eq('user_id', user.id)
          .eq('inventory_id', inventoryId)
          .single();

        if (batchFetchError || !batch) {
          return NextResponse.json(
            { success: false, message: 'Batch not found' },
            { status: 404 }
          );
        }

        if (quantity > batch.quantity_remaining) {
          return NextResponse.json(
            { success: false, message: 'Cannot remove more than available in batch' },
            { status: 400 }
          );
        }

        // Update batch quantities
        const newNotes = batch.notes 
          ? `${batch.notes}\nRemoved: ${reason} (-${quantity})` 
          : `Removed: ${reason} (-${quantity})`;

        const { data: updatedBatchData, error: updateError } = await supabaseAdmin
          .from('inventory_batches')
          .update({
            quantity_remaining: batch.quantity_remaining - quantity,
            quantity_sold: (batch.quantity_sold || 0) + quantity,
            notes: newNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', batchId)
          .select()
          .single();

        if (updateError) {
          console.error('Batch update error:', updateError);
          return NextResponse.json(
            { success: false, message: 'Failed to update batch' },
            { status: 500 }
          );
        }

        updatedBatch = transformBatch(updatedBatchData);
        affectedBatches.push({
          batchId: batch.id,
          batchCode: batch.batch_code,
          quantityRemoved: quantity,
          remainingAfter: batch.quantity_remaining - quantity
        });

      } else {
        // Use FIFO to remove from oldest batches first
        const { data: activeBatches, error: batchesError } = await supabaseAdmin
          .from('inventory_batches')
          .select('*')
          .eq('user_id', user.id)
          .eq('inventory_id', inventoryId)
          .eq('status', 'active')
          .gt('quantity_remaining', 0)
          .order('date_received', { ascending: true });

        if (batchesError) {
          console.error('Batch fetch error:', batchesError);
          return NextResponse.json(
            { success: false, message: 'Failed to fetch batches' },
            { status: 500 }
          );
        }

        let remainingToRemove = quantity;

        for (const batch of (activeBatches || [])) {
          if (remainingToRemove <= 0) break;

          const removeFromBatch = Math.min(remainingToRemove, batch.quantity_remaining);
          
          const newNotes = batch.notes 
            ? `${batch.notes}\nRemoved: ${reason} (-${removeFromBatch})` 
            : `Removed: ${reason} (-${removeFromBatch})`;

          const { error: updateError } = await supabaseAdmin
            .from('inventory_batches')
            .update({
              quantity_remaining: batch.quantity_remaining - removeFromBatch,
              quantity_sold: (batch.quantity_sold || 0) + removeFromBatch,
              notes: newNotes,
              updated_at: new Date().toISOString()
            })
            .eq('id', batch.id);

          if (updateError) {
            console.error('Batch update error:', updateError);
          }

          affectedBatches.push({
            batchId: batch.id,
            batchCode: batch.batch_code,
            quantityRemoved: removeFromBatch,
            remainingAfter: batch.quantity_remaining - removeFromBatch
          });

          remainingToRemove -= removeFromBatch;
        }

        if (remainingToRemove > 0) {
          return NextResponse.json(
            { success: false, message: 'Insufficient stock in batches' },
            { status: 400 }
          );
        }

        updatedBatch = affectedBatches;
      }

      // Update inventory totals
      const newStockQuantity = previousStock - quantity;
      const { error: invUpdateError } = await supabaseAdmin
        .from('inventory')
        .update({
          stock_quantity: newStockQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryId);

      if (invUpdateError) {
        console.error('Inventory update error:', invUpdateError);
      }

      // Track activity
      try {
        await supabaseAdmin
          .from('inventory_activities')
          .insert({
            user_id: user.id,
            inventory_id: inventoryId,
            activity_type: 'stock_removed',
            quantity_before: previousStock,
            quantity_changed: -quantity,
            quantity_after: newStockQuantity,
            reason: reason,
            metadata: {
              batchType: batchId ? 'specific' : 'fifo',
              affectedBatches: affectedBatches
            }
          });
      } catch (activityError) {
        console.error('Activity tracking failed:', activityError);
      }

      return NextResponse.json({
        success: true,
        message: 'Stock removed successfully',
        data: {
          inventory: {
            _id: inventoryId,
            id: inventoryId,
            quantityInStock: newStockQuantity,
            stockQuantity: newStockQuantity
          },
          batch: updatedBatch,
          affectedBatches: affectedBatches,
          stockChange: {
            type,
            quantity,
            previousStock,
            newStock: newStockQuantity
          }
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
