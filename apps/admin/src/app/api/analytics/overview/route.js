import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const TREND_DAYS = 30;
const TOP_STORES_LIMIT = 10;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

// Monthly-equivalent price for a subscription row, regardless of its
// billing_cycle -- lets active rows of any cycle sum into one MRR figure.
function monthlyPrice(sub) {
  const price = parseFloat(sub.price) || 0;
  if (sub.billing_cycle === 'yearly') return price / 12;
  if (sub.billing_cycle === 'quarterly') return price / 3;
  return price; // monthly
}

// Processing volume (Paystack-processed GMV, from order_payment_splits --
// see the Payments route's own comment on why that's the right scope),
// two MRR/ARR framings (a commission run-rate, since Stora has no real
// subscription revenue today -- confirmed the `subscriptions` table is
// 100% free-trial rows at price 0 -- plus the literal subscriptions
// figure so the plumbing is ready whenever paid plans launch), and the
// top stores by that same Paystack-processed volume.
//
// Trend/top-stores come from fn_admin_processing_volume_trend and
// fn_admin_top_stores_by_volume (see
// apps/dashboard/supabase/migrations/20260902000001_admin_aggregate_functions.sql)
// -- grouped/sorted/limited in SQL, rather than pulling every charged
// split in the window into JS to do the same.
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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [trendResult, topStoresResult, monthResult, subsResult] = await Promise.all([
      supabaseAdmin.rpc('fn_admin_processing_volume_trend', { p_start: rangeStart.toISOString(), p_end: rangeEnd.toISOString() }),
      supabaseAdmin.rpc('fn_admin_top_stores_by_volume', { p_start: rangeStart.toISOString(), p_limit: TOP_STORES_LIMIT }),
      supabaseAdmin.rpc('fn_admin_processing_volume_trend', { p_start: monthStart.toISOString(), p_end: rangeEnd.toISOString() }),
      supabaseAdmin.from('subscriptions').select('price, billing_cycle, status').eq('status', 'active')
    ]);

    if (trendResult.error) {
      console.error('Error fetching processing volume trend:', trendResult.error);
      return NextResponse.json({ success: false, message: 'Failed to load analytics' }, { status: 500 });
    }
    if (topStoresResult.error) {
      console.error('Error fetching top stores by volume:', topStoresResult.error);
      return NextResponse.json({ success: false, message: 'Failed to load analytics' }, { status: 500 });
    }
    if (monthResult.error) {
      console.error('Error fetching month-to-date volume:', monthResult.error);
      return NextResponse.json({ success: false, message: 'Failed to load analytics' }, { status: 500 });
    }
    if (subsResult.error) {
      console.error('Error fetching subscriptions for analytics:', subsResult.error);
      return NextResponse.json({ success: false, message: 'Failed to load analytics' }, { status: 500 });
    }

    const buckets = new Map();
    for (let i = 0; i < TREND_DAYS; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      buckets.set(dayKey(d), { date: dayKey(d), revenue: 0, orders: 0 });
    }
    (trendResult.data || []).forEach((row) => {
      const bucket = buckets.get(row.day);
      if (bucket) {
        bucket.revenue = parseFloat(row.gross) || 0;
        bucket.orders = parseInt(row.transaction_count) || 0;
      }
    });

    const todayVolume = buckets.get(dayKey(startOfToday))?.revenue || 0;
    const monthVolume = (monthResult.data || []).reduce((sum, row) => sum + (parseFloat(row.gross) || 0), 0);

    // Commission run-rate: trailing-30-day commission taken as a monthly
    // run-rate (the window IS a month), annualized for ARR. Labeled
    // clearly on the page as a run-rate, not literal recurring revenue.
    const { data: commissionData, error: commissionError } = await supabaseAdmin.rpc('fn_admin_commission_in_range', {
      p_start: rangeStart.toISOString(),
      p_end: rangeEnd.toISOString()
    });
    if (commissionError) {
      console.error('Error fetching trailing commission for analytics:', commissionError);
      return NextResponse.json({ success: false, message: 'Failed to load analytics' }, { status: 500 });
    }
    const commissionRunRateMRR = parseFloat(commissionData) || 0;
    const commissionRunRateARR = commissionRunRateMRR * 12;

    // Literal subscription MRR/ARR -- reads 0 today (every subscriptions
    // row is a free trial), correct once real paid plans exist.
    const subscriptionMRR = (subsResult.data || []).reduce((sum, sub) => sum + monthlyPrice(sub), 0);
    const subscriptionARR = subscriptionMRR * 12;

    const topStoreRows = topStoresResult.data || [];
    const topStoreIds = topStoreRows.map((r) => r.store_id);
    let storesById = new Map();
    if (topStoreIds.length > 0) {
      const { data: stores, error: storesError } = await supabaseAdmin
        .from('stores')
        .select('id, store_name, store_slug')
        .in('id', topStoreIds);
      if (storesError) {
        console.error('Error loading top stores for analytics:', storesError);
        return NextResponse.json({ success: false, message: 'Failed to load analytics' }, { status: 500 });
      }
      storesById = new Map((stores || []).map((s) => [s.id, s]));
    }

    const topStores = topStoreRows.map((r) => ({
      storeId: r.store_id,
      storeName: storesById.get(r.store_id)?.store_name || 'Unknown vendor',
      storeSlug: storesById.get(r.store_id)?.store_slug || null,
      volume: parseFloat(r.volume) || 0
    }));

    return NextResponse.json({
      success: true,
      trend: Array.from(buckets.values()),
      todayVolume,
      monthVolume,
      mrr: {
        commissionRunRate: commissionRunRateMRR,
        subscription: subscriptionMRR
      },
      arr: {
        commissionRunRate: commissionRunRateARR,
        subscription: subscriptionARR
      },
      topStores
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
