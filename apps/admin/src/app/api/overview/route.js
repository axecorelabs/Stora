import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const TREND_DAYS = 14;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

// Platform-wide overview: vendor/product/order counts, a revenue+orders
// trend, top categories across every store, and recent signups.
//
// Revenue/trend/category rollups come from the SQL aggregate functions in
// apps/dashboard/supabase/migrations/20260902000001_admin_aggregate_functions.sql
// (fn_admin_daily_revenue_trend, fn_admin_total_revenue,
// fn_admin_product_category_stats) -- this route used to pull every
// order/order_item/sale/inventory_variant into JS to compute the same
// numbers, which does not scale as those tables grow. Every count query
// below (stores/products/orders totals) was already cheap (head:true,
// indexed) and needed no change.
export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rangeStart = new Date(startOfToday);
    rangeStart.setDate(rangeStart.getDate() - (TREND_DAYS - 1));
    const rangeEnd = new Date(startOfToday);
    rangeEnd.setDate(rangeEnd.getDate() + 1);

    const [
      storesTotal,
      storesActive,
      productsTotal,
      productsActive,
      ordersTotal,
      ordersToday,
      trendResult,
      totalRevenueResult,
      categoryStatsResult,
      recentVendors
    ] = await Promise.all([
      supabaseAdmin.from('stores').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('inventory').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
      supabaseAdmin.from('inventory').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('is_active', true),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday.toISOString()),
      supabaseAdmin.rpc('fn_admin_daily_revenue_trend', { p_start: rangeStart.toISOString(), p_end: rangeEnd.toISOString() }),
      supabaseAdmin.rpc('fn_admin_total_revenue'),
      supabaseAdmin.rpc('fn_admin_product_category_stats', { p_active_only: true }),
      supabaseAdmin.from('stores').select('store_name, store_slug, created_at').order('created_at', { ascending: false }).limit(8)
    ]);

    if (trendResult.error) {
      console.error('Error fetching revenue trend for overview:', trendResult.error);
      return NextResponse.json({ success: false, message: 'Failed to load overview' }, { status: 500 });
    }
    if (totalRevenueResult.error) {
      console.error('Error fetching total revenue for overview:', totalRevenueResult.error);
      return NextResponse.json({ success: false, message: 'Failed to load overview' }, { status: 500 });
    }
    if (categoryStatsResult.error) {
      console.error('Error fetching category stats for overview:', categoryStatsResult.error);
      return NextResponse.json({ success: false, message: 'Failed to load overview' }, { status: 500 });
    }

    // Seed every day in the trailing-N-day window so gaps show as zero,
    // then fill in whatever days the SQL function actually returned rows for.
    const buckets = new Map();
    for (let i = 0; i < TREND_DAYS; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      buckets.set(dayKey(d), { date: dayKey(d), revenue: 0, orders: 0 });
    }
    (trendResult.data || []).forEach((row) => {
      const bucket = buckets.get(row.day);
      if (bucket) {
        bucket.revenue = parseFloat(row.revenue) || 0;
        bucket.orders = parseInt(row.order_count) || 0;
      }
    });

    const topCategories = (categoryStatsResult.data || []).map((row) => ({
      category: row.category,
      totalStock: parseInt(row.total_stock) || 0
    }));

    return NextResponse.json({
      success: true,
      overview: {
        vendors: { total: storesTotal.count || 0, active: storesActive.count || 0 },
        products: { total: productsTotal.count || 0, active: productsActive.count || 0 },
        orders: { total: ordersTotal.count || 0, today: ordersToday.count || 0 },
        revenue: { total: parseFloat(totalRevenueResult.data) || 0 },
        trend: Array.from(buckets.values()),
        topCategories,
        recentVendors: (recentVendors.data || []).map((s) => ({
          storeName: s.store_name,
          storeSlug: s.store_slug,
          createdAt: s.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Overview error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
