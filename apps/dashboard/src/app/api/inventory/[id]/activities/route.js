import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// Helper to transform activity data
function transformActivity(activity) {
  if (!activity) return null;
  return {
    id: activity.id,
    _id: activity.id,
    mongoId: activity.mongo_id,
    inventoryId: activity.inventory_id,
    userId: activity.user_id,
    activityType: activity.activity_type,
    quantityBefore: activity.quantity_before,
    quantityChanged: activity.quantity_changed,
    quantityAfter: activity.quantity_after,
    reason: activity.reason,
    notes: activity.notes,
    batchId: activity.batch_id,
    batchCode: activity.batch_code,
    relatedOrderId: activity.related_order_id,
    relatedSaleId: activity.related_sale_id,
    metadata: activity.metadata,
    createdAt: activity.created_at,
    updatedAt: activity.updated_at
  };
}

// GET - Fetch activities for specific inventory item
export async function GET(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id: inventoryId } = await params;
    const { searchParams } = new URL(req.url);
    
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const activityType = searchParams.get('activityType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('inventory_activities')
      .select('*', { count: 'exact' })
      .eq('inventory_id', inventoryId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (activityType) {
      query = query.eq('activity_type', activityType);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: activities, error, count } = await query;

    if (error) {
      console.error('Activity fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    // Get activity statistics
    const { data: statsData } = await supabaseAdmin
      .from('inventory_activities')
      .select('activity_type, quantity_changed')
      .eq('inventory_id', inventoryId)
      .eq('user_id', user.id);

    // Calculate stats
    const stats = {
      totalActivities: statsData?.length || 0,
      stockAdded: 0,
      stockRemoved: 0,
      sales: 0,
      adjustments: 0
    };

    (statsData || []).forEach(activity => {
      if (activity.activity_type === 'stock_added') {
        stats.stockAdded += activity.quantity_changed || 0;
      } else if (activity.activity_type === 'stock_removed' || activity.activity_type === 'sold') {
        stats.stockRemoved += Math.abs(activity.quantity_changed || 0);
      }
      if (activity.activity_type === 'sold') {
        stats.sales++;
      }
      if (activity.activity_type === 'adjustment') {
        stats.adjustments++;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        activities: (activities || []).map(transformActivity),
        stats,
        pagination: {
          page,
          limit,
          total: count || 0
        }
      }
    });

  } catch (error) {
    console.error('Activity fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
