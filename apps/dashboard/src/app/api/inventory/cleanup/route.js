import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// POST - Cleanup job to permanently delete items soft-deleted for more than 30 days
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find items that have been soft-deleted for more than 30 days
    const { data: itemsToDelete, error: fetchError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', true)
      .lte('deleted_at', thirtyDaysAgo.toISOString());

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch items' },
        { status: 500 }
      );
    }

    if (!itemsToDelete || itemsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items eligible for permanent deletion',
        count: 0
      });
    }

    const deletionResults = {
      success: [],
      failed: [],
      skipped: []
    };

    // Process each item
    for (const item of itemsToDelete) {
      try {
        const itemId = item.id;

        // Final check: ensure no sales or orders exist
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
          // Skip items with transaction history
          deletionResults.skipped.push({
            itemId: itemId,
            productName: item.name,
            sku: item.sku,
            reason: `Has transaction history (${salesCount} sales, ${ordersCount} orders)`,
            dependencies: {
              sales: salesCount,
              orders: ordersCount
            }
          });
          continue;
        }

        // Delete all associated batches
        await supabaseAdmin
          .from('inventory_batches')
          .delete()
          .eq('inventory_id', itemId);

        // Delete all associated activities
        await supabaseAdmin
          .from('inventory_activities')
          .delete()
          .eq('inventory_id', itemId);

        // Delete the item
        const { error: deleteError } = await supabaseAdmin
          .from('inventory')
          .delete()
          .eq('id', itemId);

        if (deleteError) {
          throw deleteError;
        }

        deletionResults.success.push({
          itemId: itemId,
          productName: item.name,
          sku: item.sku,
          originalDeletionDate: item.deleted_at,
          permanentDeletionDate: new Date()
        });

      } catch (error) {
        console.error(`Failed to delete item ${item.id}:`, error);
        deletionResults.failed.push({
          itemId: item.id,
          productName: item.name,
          sku: item.sku,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed: ${deletionResults.success.length} deleted, ${deletionResults.skipped.length} skipped, ${deletionResults.failed.length} failed`,
      results: deletionResults,
      summary: {
        totalProcessed: itemsToDelete.length,
        successfullyDeleted: deletionResults.success.length,
        skipped: deletionResults.skipped.length,
        failed: deletionResults.failed.length
      }
    });

  } catch (error) {
    console.error('Cleanup job error:', error);
    return NextResponse.json(
      { success: false, message: 'Cleanup job failed', error: error.message },
      { status: 500 }
    );
  }
}

// GET - Preview items that will be deleted in cleanup
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find items that have been soft-deleted for more than 30 days
    const { data: eligibleItems, error: fetchError } = await supabaseAdmin
      .from('inventory')
      .select('id, name, sku, category, deleted_at')
      .eq('user_id', user.id)
      .eq('is_deleted', true)
      .lte('deleted_at', thirtyDaysAgo.toISOString());

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch items' },
        { status: 500 }
      );
    }

    if (!eligibleItems || eligibleItems.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          totalEligible: 0,
          canBeDeleted: 0,
          cannotBeDeleted: 0
        },
        items: {
          canDelete: [],
          cannotDelete: []
        }
      });
    }

    // Get dependency counts for each item
    const itemsWithDependencies = await Promise.all(
      eligibleItems.map(async (item) => {
        const [salesResult, batchesResult, ordersResult] = await Promise.all([
          supabaseAdmin
            .from('item_sales')
            .select('*', { count: 'exact', head: true })
            .eq('inventory_id', item.id),
          supabaseAdmin
            .from('inventory_batches')
            .select('*', { count: 'exact', head: true })
            .eq('inventory_id', item.id),
          supabaseAdmin
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', item.id)
        ]);

        const salesCount = salesResult.count || 0;
        const batchesCount = batchesResult.count || 0;
        const ordersCount = ordersResult.count || 0;

        return {
          itemId: item.id,
          productName: item.name,
          sku: item.sku,
          category: item.category,
          deletedAt: item.deleted_at,
          daysSinceDeletion: Math.floor((Date.now() - new Date(item.deleted_at)) / (1000 * 60 * 60 * 24)),
          canBeDeleted: salesCount === 0 && ordersCount === 0,
          dependencies: {
            sales: salesCount,
            batches: batchesCount,
            orders: ordersCount
          }
        };
      })
    );

    const canDelete = itemsWithDependencies.filter(item => item.canBeDeleted);
    const cannotDelete = itemsWithDependencies.filter(item => !item.canBeDeleted);

    return NextResponse.json({
      success: true,
      summary: {
        totalEligible: eligibleItems.length,
        canBeDeleted: canDelete.length,
        cannotBeDeleted: cannotDelete.length
      },
      items: {
        canDelete: canDelete,
        cannotDelete: cannotDelete
      }
    });

  } catch (error) {
    console.error('Preview cleanup error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to preview cleanup', error: error.message },
      { status: 500 }
    );
  }
}
