import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Same values apps/dashboard's own Payments page surfaces for a vendor
// (orders/create's checkout math is the actual source of truth; this is
// display-only, same as that route's own comment explains).
const PLATFORM_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.02');

// Platform-wide payments ledger -- backed by fn_admin_payments_stats and
// fn_admin_vendor_payouts (see
// apps/dashboard/supabase/migrations/20260902000001_admin_aggregate_functions.sql),
// which apply the exact same CHARGED_STATUSES gate
// apps/dashboard/src/app/api/payments/route.js uses for a single vendor
// (a split exists the instant an order is placed against a
// paystack_ready store, before the charge itself is confirmed -- only
// order_payments.status says whether money actually moved), just
// aggregated server-side across every store instead of pulling every
// charged split into JS to sum. order_payment_splits only ever has rows
// for paystack_ready stores (see apps/store's computePaymentSplit) -- a
// non-ready vendor's orders go through a WhatsApp-contact path with no
// Stora payment processing at all, so this ledger is correctly "money
// that flowed through Stora," not total platform order volume.
export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  try {
    const [statsResult, payoutsResult] = await Promise.all([
      supabaseAdmin.rpc('fn_admin_payments_stats'),
      supabaseAdmin.rpc('fn_admin_vendor_payouts')
    ]);

    if (statsResult.error) {
      console.error('Error fetching payments stats:', statsResult.error);
      return NextResponse.json({ success: false, message: 'Failed to load payments' }, { status: 500 });
    }
    if (payoutsResult.error) {
      console.error('Error fetching vendor payouts:', payoutsResult.error);
      return NextResponse.json({ success: false, message: 'Failed to load payments' }, { status: 500 });
    }

    const row = statsResult.data?.[0] || {};
    const stats = {
      totalCommission: parseFloat(row.total_commission) || 0,
      totalPartnerCommission: parseFloat(row.total_partner_commission) || 0,
      totalPaidOut: parseFloat(row.total_paid_out) || 0,
      totalPendingPayout: parseFloat(row.total_pending_payout) || 0,
      totalRefunded: parseFloat(row.total_refunded) || 0,
      totalGross: parseFloat(row.total_gross) || 0,
      transactionCount: parseInt(row.transaction_count) || 0
    };

    const payoutRows = payoutsResult.data || [];
    const storeIds = payoutRows.map((r) => r.store_id);
    let storesById = new Map();
    if (storeIds.length > 0) {
      const { data: stores, error: storesError } = await supabaseAdmin
        .from('stores')
        .select('id, store_name, store_slug')
        .in('id', storeIds);
      if (storesError) {
        console.error('Error loading stores for payments overview:', storesError);
        return NextResponse.json({ success: false, message: 'Failed to load payments' }, { status: 500 });
      }
      storesById = new Map((stores || []).map((s) => [s.id, s]));
    }

    const vendorPayouts = payoutRows
      .map((r) => ({
        storeId: r.store_id,
        storeName: storesById.get(r.store_id)?.store_name || 'Unknown vendor',
        storeSlug: storesById.get(r.store_id)?.store_slug || null,
        gross: parseFloat(r.gross) || 0,
        commission: parseFloat(r.commission) || 0,
        net: parseFloat(r.net) || 0,
        pendingPayout: parseFloat(r.pending_payout) || 0,
        refunded: parseFloat(r.refunded) || 0,
        transactionCount: parseInt(r.transaction_count) || 0
      }))
      .sort((a, b) => b.pendingPayout - a.pendingPayout);

    return NextResponse.json({
      success: true,
      stats,
      commissionRate: PLATFORM_COMMISSION_RATE,
      vendorPayouts
    });
  } catch (error) {
    console.error('Payments overview error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
