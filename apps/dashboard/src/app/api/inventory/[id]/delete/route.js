import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// Helper to transform inventory data
function transformInventory(item) {
  if (!item) return null;
  return {
    id: item.id,
    _id: item.id,
    productName: item.name,
    name: item.name,
    description: item.description,
    category: item.category,
    sku: item.sku,
    barcode: item.barcode,
    minimumStock: item.minimum_stock,
    images: item.images,
    tags: item.tags,
    isActive: item.is_active,
    isDeleted: item.is_deleted,
    deletedAt: item.deleted_at,
    userId: item.user_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

// DELETE - Delete/Archive inventory item (Hybrid approach with 30-day retention)
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
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';
    const reason = searchParams.get('reason') || 'No reason provided';

    // Find the item
    const { data: item, error: itemError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { success: false, message: 'Item not found' },
        { status: 404 }
      );
    }

    // If item is already soft-deleted, check if 30 days have passed
    if (item.is_deleted) {
      const daysSinceDeletion = Math.floor((Date.now() - new Date(item.deleted_at)) / (1000 * 60 * 60 * 24));
      
      if (force || daysSinceDeletion >= 30) {
        return await permanentlyDeleteItem(item, user.id);
      } else {
        return NextResponse.json({
          success: false,
          message: `Item is already deleted. It will be permanently removed after 30 days (${30 - daysSinceDeletion} days remaining). Use force=true to delete immediately.`,
          daysRemaining: 30 - daysSinceDeletion
        }, { status: 400 });
      }
    }

    // Check for dependencies (sales, batches, orders)
    const [salesResult, batchesResult, ordersResult] = await Promise.all([
      supabaseAdmin
        .from('item_sales')
        .select('*', { count: 'exact', head: true })
        .eq('inventory_id', id),
      supabaseAdmin
        .from('inventory_batches')
        .select('*', { count: 'exact', head: true })
        .eq('inventory_id', id)
        .or('quantity_sold.gt.0,quantity_remaining.gt.0'),
      supabaseAdmin
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', id)
    ]);

    const salesCount = salesResult.count || 0;
    const activeBatchesCount = batchesResult.count || 0;
    const ordersCount = ordersResult.count || 0;

    const hasDependencies = salesCount > 0 || activeBatchesCount > 0 || ordersCount > 0;

    if (hasDependencies || !force) {
      // SOFT DELETE - Archive the item
      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        console.error('Soft delete error:', updateError);
        return NextResponse.json(
          { success: false, message: 'Failed to archive item' },
          { status: 500 }
        );
      }

      // Archive all batches
      await supabaseAdmin
        .from('inventory_batches')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString()
        })
        .eq('inventory_id', id);

      // Log activity -- quantity is the sum across this product's
      // variants now, not a flat inventory column.
      try {
        const { data: variantsAtDelete } = await supabaseAdmin
          .from('inventory_variants')
          .select('quantity_in_stock')
          .eq('inventory_id', id);
        const stockAtDelete = (variantsAtDelete || []).reduce((sum, v) => sum + (v.quantity_in_stock || 0), 0);

        await supabaseAdmin
          .from('inventory_activities')
          .insert({
            user_id: user.id,
            inventory_id: id,
            activity_type: 'deleted',
            quantity_before: stockAtDelete,
            quantity_changed: 0,
            quantity_after: stockAtDelete,
            reason: reason,
            metadata: {
              dependencies: {
                sales: salesCount,
                batches: activeBatchesCount,
                orders: ordersCount
              }
            }
          });
      } catch (activityError) {
        console.error('Activity tracking failed:', activityError);
      }

      return NextResponse.json({
        success: true,
        type: 'soft_delete',
        message: `Item archived successfully. ${hasDependencies ? `Item has transaction history (${salesCount} sales, ${activeBatchesCount} batches, ${ordersCount} orders).` : ''} It will be permanently deleted after 30 days.`,
        data: {
          itemId: id,
          deletedAt: new Date().toISOString(),
          permanentDeletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          dependencies: {
            sales: salesCount,
            batches: activeBatchesCount,
            orders: ordersCount
          }
        }
      });

    } else {
      // No dependencies and force flag - allow immediate permanent deletion
      return await permanentlyDeleteItem(item, user.id, reason);
    }

  } catch (error) {
    console.error('Delete inventory error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete item', error: error.message },
      { status: 500 }
    );
  }
}

// Helper function for permanent deletion
async function permanentlyDeleteItem(item, userId, reason = '') {
  try {
    const itemId = item.id;
    const itemData = {
      productName: item.name,
      sku: item.sku,
      category: item.category
    };

    // Check one more time for any dependencies
    const [salesResult, ordersResult] = await Promise.all([
      supabaseAdmin
        .from('item_sales')
        .select('*', { count: 'exact', head: true })
        .eq('inventory_id', itemId),
      supabaseAdmin
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', itemId)
    ]);

    const salesCount = salesResult.count || 0;
    const ordersCount = ordersResult.count || 0;

    if (salesCount > 0 || ordersCount > 0) {
      return NextResponse.json({
        success: false,
        message: `Cannot permanently delete: Item still has transaction history (${salesCount} sales, ${ordersCount} orders). These records must be preserved.`,
        dependencies: {
          sales: salesCount,
          orders: ordersCount
        }
      }, { status: 400 });
    }

    // Delete all batches
    await supabaseAdmin
      .from('inventory_batches')
      .delete()
      .eq('inventory_id', itemId);

    // Delete all activities
    await supabaseAdmin
      .from('inventory_activities')
      .delete()
      .eq('inventory_id', itemId);

    // Delete the inventory item
    const { error: deleteError } = await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      console.error('Permanent delete error:', deleteError);
      return NextResponse.json(
        { success: false, message: 'Failed to permanently delete item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      type: 'hard_delete',
      message: 'Item permanently deleted successfully',
      data: {
        itemId: itemId,
        productName: itemData.productName,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Permanent deletion error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to permanently delete item', error: error.message },
      { status: 500 }
    );
  }
}

// POST - Restore a soft-deleted item
export async function POST(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Find the deleted item
    const { data: item, error: itemError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', true)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { success: false, message: 'Deleted item not found' },
        { status: 404 }
      );
    }

    // Check if 30 days have passed
    const daysSinceDeletion = Math.floor((Date.now() - new Date(item.deleted_at)) / (1000 * 60 * 60 * 24));
    if (daysSinceDeletion >= 30) {
      return NextResponse.json({
        success: false,
        message: 'Cannot restore: Item has been deleted for more than 30 days and is scheduled for permanent deletion'
      }, { status: 400 });
    }

    // Restore the item
    const { data: restoredItem, error: updateError } = await supabaseAdmin
      .from('inventory')
      .update({
        is_deleted: false,
        deleted_at: null,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Restore error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to restore item' },
        { status: 500 }
      );
    }

    // Restore archived batches
    await supabaseAdmin
      .from('inventory_batches')
      .update({
        status: 'active',
        archived_at: null
      })
      .eq('inventory_id', id)
      .eq('status', 'archived');

    // Log activity -- quantity is the sum across this product's variants.
    try {
      const { data: variantsAtRestore } = await supabaseAdmin
        .from('inventory_variants')
        .select('quantity_in_stock')
        .eq('inventory_id', id);
      const stockAtRestore = (variantsAtRestore || []).reduce((sum, v) => sum + (v.quantity_in_stock || 0), 0);

      await supabaseAdmin
        .from('inventory_activities')
        .insert({
          user_id: user.id,
          inventory_id: id,
          activity_type: 'restored',
          quantity_before: stockAtRestore,
          quantity_changed: 0,
          quantity_after: stockAtRestore,
          reason: 'Item restored from deletion',
          metadata: {
            restoredAt: new Date().toISOString()
          }
        });
    } catch (activityError) {
      console.error('Activity tracking failed:', activityError);
    }

    return NextResponse.json({
      success: true,
      message: 'Item restored successfully',
      data: transformInventory(restoredItem)
    });

  } catch (error) {
    console.error('Restore item error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to restore item', error: error.message },
      { status: 500 }
    );
  }
}
