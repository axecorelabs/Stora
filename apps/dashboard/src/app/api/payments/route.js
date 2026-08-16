import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

const EMPTY_DATA = (page, limit) => ({
  transactions: [],
  stats: { totalGross: 0, totalCommission: 0, totalNet: 0, totalRefunded: 0, transactionCount: 0 },
  payoutAccount: { ready: false },
  commissionBearer: 'vendor',
  pagination: { current: page, pages: 0, total: 0, limit, hasMore: false }
});

// GET - This vendor's own slice of order_payment_splits (the per-vendor
// breakdown row for every Paystack transaction that included their items),
// joined to the parent order and payment record. This is deliberately a
// separate page from Orders/Sales: those are about fulfillment and
// inventory, this is about money -- what Stora collected on this vendor's
// behalf, the platform commission taken, what's owed to them, and what's
// been reversed via the dashboard's refund-recording action (the
// accountability trail that action explicitly exists to produce).
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const status = searchParams.get('status'); // 'paid' | 'refunded'
    const search = searchParams.get('search'); // order number
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, bank_details, commission_bearer')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({ success: true, data: EMPTY_DATA(page, limit) });
    }

    const bankDetails = typeof store.bank_details === 'string'
      ? JSON.parse(store.bank_details)
      : store.bank_details || {};

    const payoutAccount = bankDetails.paystack_subaccount_code
      ? {
          ready: true,
          bankName: bankDetails.bank_name || null,
          accountName: bankDetails.account_name || null,
          accountNumberLast4: bankDetails.account_number ? String(bankDetails.account_number).slice(-4) : null,
          // Raw fields, passed through as-is so this page can hand them
          // straight to PayoutSettingsModal (which pre-fills its form from
          // store.bankDetails.{bank_code,account_number,account_name}) --
          // it expects the same shape stores/payouts's transformStore()
          // already produces, so no separate store fetch is needed here.
          bankDetails
        }
      : { ready: false, bankDetails };

    // Resolve order-number search to a set of order IDs first, rather than
    // filtering the embedded `orders` relation directly -- keeps this on
    // the same proven pattern the existing /api/orders route already uses
    // instead of relying on untested PostgREST embedded-filter syntax.
    let searchOrderIds = null;
    if (search) {
      const { data: matchingOrders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .ilike('order_number', `%${search}%`);
      searchOrderIds = (matchingOrders || []).map(o => o.id);
      if (searchOrderIds.length === 0) {
        return NextResponse.json({ success: true, data: EMPTY_DATA(page, limit) });
      }
    }

    let query = supabaseAdmin
      .from('order_payment_splits')
      .select(
        '*, orders!inner(order_number, status, created_at), order_payments!inner(status, method, provider, reference, paid_at, refunded_at, refund_amount)',
        { count: 'exact' }
      )
      .eq('store_id', store.id);

    if (status === 'paid') {
      query = query.eq('status', 'pending');
    } else if (status === 'refunded') {
      query = query.eq('status', 'reversed');
    }
    if (searchOrderIds) {
      query = query.in('order_id', searchOrderIds);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: rawSplits, error, count: totalCount } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Payments fetch error:', error);
      return NextResponse.json({ success: false, message: 'Failed to fetch payments' }, { status: 500 });
    }

    const transactions = (rawSplits || []).map(split => ({
      id: split.id,
      orderId: split.order_id,
      orderNumber: split.orders?.order_number,
      orderStatus: split.orders?.status,
      grossAmount: parseFloat(split.gross_amount),
      commissionRate: parseFloat(split.platform_commission_rate),
      commissionAmount: parseFloat(split.platform_commission_amount),
      netAmount: parseFloat(split.net_amount_to_vendor),
      // Snapshotted at checkout time -- reflects the mode active when
      // THIS order was placed, not this vendor's current setting.
      commissionBearer: split.commission_bearer === 'customer' ? 'customer' : 'vendor',
      customerAmount: parseFloat(split.customer_amount ?? split.gross_amount),
      // 'pending' here just means "not reversed" -- Paystack settles
      // automatically (T+1) straight to the vendor's bank account, this
      // app has no visibility into or control over that leg, so 'pending'
      // is NOT "we haven't paid you yet". Surfaced to the UI as "Paid".
      splitStatus: split.status,
      paymentStatus: split.order_payments?.status,
      paymentMethod: split.order_payments?.method,
      paymentProvider: split.order_payments?.provider,
      reference: split.order_payments?.reference,
      paidAt: split.order_payments?.paid_at,
      refundedAt: split.order_payments?.refunded_at,
      createdAt: split.created_at
    }));

    // Stats cover this store's full history, not just the current page --
    // a second, unpaginated, lightweight query scoped the same way.
    const { data: allSplits } = await supabaseAdmin
      .from('order_payment_splits')
      .select('gross_amount, platform_commission_amount, net_amount_to_vendor, status')
      .eq('store_id', store.id);

    const nonReversed = (allSplits || []).filter(s => s.status !== 'reversed');
    const reversed = (allSplits || []).filter(s => s.status === 'reversed');

    const stats = {
      totalGross: nonReversed.reduce((sum, s) => sum + parseFloat(s.gross_amount || 0), 0),
      totalCommission: nonReversed.reduce((sum, s) => sum + parseFloat(s.platform_commission_amount || 0), 0),
      totalNet: nonReversed.reduce((sum, s) => sum + parseFloat(s.net_amount_to_vendor || 0), 0),
      // Approximation, not an exact figure: order_payment_splits has no
      // per-split refund amount column, only a reversed/not-reversed
      // status -- only order_payments.refund_amount tracks a dollar
      // figure, and that's cumulative at the ORDER level (which can span
      // more than one vendor's split on a multi-vendor order). Using the
      // split's full gross_amount is exact for the common case
      // (single-vendor order, full refund) and an overestimate only for a
      // partial refund on a multi-vendor order.
      totalRefunded: reversed.reduce((sum, s) => sum + parseFloat(s.gross_amount || 0), 0),
      transactionCount: (allSplits || []).length
    };

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        stats,
        payoutAccount,
        commissionBearer: store.commission_bearer === 'customer' ? 'customer' : 'vendor',
        pagination: {
          current: page,
          pages: Math.ceil((totalCount || 0) / limit),
          total: totalCount || 0,
          limit,
          hasMore: page < Math.ceil((totalCount || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Payments fetch error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
