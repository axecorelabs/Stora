import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // First get the user's store
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({
        success: true,
        stats: {
          totalOrders: 0,
          pendingOrders: 0,
          confirmedOrders: 0,
          processingOrders: 0,
          shippedOrders: 0,
          deliveredOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          refundedOrders: 0,
          totalRevenue: 0
        }
      });
    }

    // orders is multi-vendor: scope through order_items.store_id, not
    // orders.store_id (orders has no store_id column). Revenue is this
    // store's share (item subtotals), not the whole order's total_amount,
    // since an order can span multiple stores.
    const { data: storeItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('order_id, subtotal, item_status')
      .eq('store_id', store.id);

    if (itemsError) {
      console.error('Error fetching order items for stats:', itemsError);
      return NextResponse.json(
        { error: 'Failed to fetch order statistics' },
        { status: 500 }
      );
    }

    const orderIds = [...new Set((storeItems || []).map(i => i.order_id))];
    let orders = [];
    if (orderIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('id, status')
        .in('id', orderIds);
      if (error) {
        console.error('Error fetching orders for stats:', error);
        return NextResponse.json(
          { error: 'Failed to fetch order statistics' },
          { status: 500 }
        );
      }
      orders = data || [];
    }

    // Revenue-eligible orders, keyed by order-level status -- order_items.item_status
    // is never kept in sync when an order's status changes (a pre-existing gap in the
    // status-update route, not something to paper over here), so it can't be trusted
    // for this calculation.
    const revenueOrderIds = new Set(
      orders.filter(o => ['processed', 'shipped', 'delivered'].includes(o.status)).map(o => o.id)
    );

    // Calculate stats
    const statsData = {
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      confirmedOrders: orders.filter(o => o.status === 'confirmed').length,
      processingOrders: orders.filter(o => o.status === 'processing').length,
      shippedOrders: orders.filter(o => o.status === 'shipped').length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
      completedOrders: orders.filter(o => o.status === 'delivered').length,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
      refundedOrders: orders.filter(o => o.status === 'refunded').length,
      totalRevenue: (storeItems || [])
        .filter(i => revenueOrderIds.has(i.order_id))
        .reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0)
    };

    return NextResponse.json({
      success: true,
      stats: statsData
    });

  } catch (error) {
    console.error('Error fetching order stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order statistics' },
      { status: 500 }
    );
  }
}
