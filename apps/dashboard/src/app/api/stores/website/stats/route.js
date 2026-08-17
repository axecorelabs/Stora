import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { redis, withTimeout } from '@/lib/redis';

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

// Reaches directly into the store app's Redis keys for "today so far" --
// same cross-app key-format dependency as invalidateStorefrontCache
// (lib/redis.js), since both apps share one physical Redis database. This
// is what keeps the widget feeling live even though the Postgres side
// (store_daily_views) only gets a batched write once a day (see
// apps/store/src/app/api/analytics/flush/route.js) -- today's count never
// waits on that flush.
async function getTodayLiveViews(storeId) {
  try {
    const value = await withTimeout(redis.get(`store:analytics:views:store:${storeId}:${todayKey()}`));
    return Number(value) || 0;
  } catch (error) {
    console.warn('Failed to read live view count:', error.message);
    return 0;
  }
}

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .select('id, total_orders')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !store) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartDate = monthStart.toISOString().slice(0, 10);

    const [allTimeResult, monthResult, liveToday, lastVisitResult] = await Promise.all([
      supabaseAdmin.from('store_daily_views').select('views').eq('store_id', store.id),
      supabaseAdmin.from('store_daily_views').select('views').eq('store_id', store.id).gte('view_date', monthStartDate),
      getTodayLiveViews(store.id),
      supabaseAdmin
        .from('store_daily_views')
        .select('view_date')
        .eq('store_id', store.id)
        .order('view_date', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const historicalTotal = (allTimeResult.data || []).reduce((sum, row) => sum + row.views, 0);
    const historicalMonth = (monthResult.data || []).reduce((sum, row) => sum + row.views, 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalViews: historicalTotal + liveToday,
        monthlyViews: historicalMonth + liveToday,
        totalOrders: store.total_orders || 0,
        lastVisit: liveToday > 0 ? new Date().toISOString() : (lastVisitResult.data?.view_date || null)
      }
    });
  } catch (error) {
    console.error('Error fetching website stats:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch stats' }, { status: 500 });
  }
}
