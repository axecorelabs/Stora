import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { refundTransaction } from '@/lib/paystack';

// POST - Refund a vendor's own share of a (possibly multi-vendor) paid
// order. Vendor-scoped, not platform-admin-only -- consistent with how
// order management is already store-scoped everywhere else in this app
// (see the sibling status route). Always allowed once paid; there is no
// settlement-status gate (see apps/dashboard/src/lib/paystack.js for why:
// Paystack refunds a split transaction from Stora's own balance
// regardless of subaccount settlement state, so there's nothing this
// route could safely block on).
export async function POST(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const { amount, note } = await req.json().catch(() => ({}));

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, store_name')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    // Same ownership check as the status route -- confirms this vendor
    // actually has items on this order before it does anything else.
    const { data: storeItems } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('order_id', id)
      .eq('store_id', store.id);

    if (!storeItems || storeItems.length === 0) {
      return NextResponse.json({ success: false, message: 'Order not found or access denied' }, { status: 404 });
    }

    const { data: orderPayment, error: paymentError } = await supabaseAdmin
      .from('order_payments')
      .select('*')
      .eq('order_id', id)
      .single();

    if (paymentError || !orderPayment || orderPayment.provider !== 'paystack') {
      return NextResponse.json({ success: false, message: 'This order has no online payment to refund' }, { status: 400 });
    }

    if (!['completed', 'partially_refunded'].includes(orderPayment.status)) {
      return NextResponse.json({ success: false, message: 'This payment has not been completed yet' }, { status: 400 });
    }

    const { data: split, error: splitError } = await supabaseAdmin
      .from('order_payment_splits')
      .select('*')
      .eq('order_payment_id', orderPayment.id)
      .eq('store_id', store.id)
      .single();

    if (splitError || !split) {
      return NextResponse.json({ success: false, message: 'No payment record found for your store on this order' }, { status: 404 });
    }

    if (split.status === 'reversed') {
      return NextResponse.json({ success: false, message: 'This has already been refunded' }, { status: 400 });
    }

    // amount is what the customer paid for this vendor's items (gross,
    // before commission), not net_amount_to_vendor -- a refund returns
    // the customer's money, it isn't priced off what the vendor keeps.
    const grossAmount = parseFloat(split.gross_amount);
    const refundAmount = amount != null ? Math.min(parseFloat(amount), grossAmount) : grossAmount;
    if (!(refundAmount > 0)) {
      return NextResponse.json({ success: false, message: 'Invalid refund amount' }, { status: 400 });
    }
    const isFullRefund = refundAmount >= grossAmount;

    try {
      await refundTransaction({
        reference: orderPayment.reference,
        amountKobo: Math.round(refundAmount * 100),
        note: note || `Refund for ${store.store_name} items on order ${id}`
      });
    } catch (error) {
      console.error('Paystack refund error:', error);
      return NextResponse.json({ success: false, message: error.message || 'Refund failed at Paystack' }, { status: 502 });
    }

    const now = new Date().toISOString();

    await supabaseAdmin
      .from('order_payment_splits')
      .update({ status: 'reversed', updated_at: now })
      .eq('id', split.id);

    // Only mark the whole payment 'refunded' once every vendor's split on
    // this order has been reversed -- a partial refund on a multi-vendor
    // order must not look like the whole order was refunded.
    const { data: allSplits } = await supabaseAdmin
      .from('order_payment_splits')
      .select('status')
      .eq('order_payment_id', orderPayment.id);

    const allReversed = (allSplits || []).every(s => s.status === 'reversed');
    const newPaymentStatus = allReversed ? 'refunded' : 'partially_refunded';
    const newRefundAmount = parseFloat(orderPayment.refund_amount || 0) + refundAmount;

    await supabaseAdmin
      .from('order_payments')
      .update({
        status: newPaymentStatus,
        refund_amount: newRefundAmount,
        refunded_at: now,
        updated_at: now
      })
      .eq('id', orderPayment.id);

    if (allReversed) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'refunded', updated_at: now })
        .eq('id', id);
    }

    return NextResponse.json({
      success: true,
      message: isFullRefund ? 'Refund completed' : 'Partial refund completed',
      refundAmount,
      orderPaymentStatus: newPaymentStatus
    });
  } catch (error) {
    console.error('Refund error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
