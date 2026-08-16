import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/auth";
import { findCustomerById } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { initializeTransaction } from "@/lib/paystack";

export async function POST(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ success: false, message: "Order ID is required" }, { status: 400 });
    }

    // Scoped to this customer's own order -- confirms ownership, same
    // pattern as every other order route in this app.
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, customer_id, status')
      .eq('id', orderId)
      .eq('customer_id', customerId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    // An order this far along (auto-cancelled by the abandoned-payment
    // cleanup job after 30 min, or cancelled/refunded some other way)
    // already had its stock reservation released -- starting a fresh
    // payment against it would let a customer pay for stock that's no
    // longer actually held for them.
    if (['cancelled', 'refunded'].includes(order.status)) {
      return NextResponse.json({ success: false, message: "This order is no longer available for payment. Please place a new order." }, { status: 400 });
    }

    const { data: orderPayment, error: paymentError } = await supabaseAdmin
      .from('order_payments')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (paymentError || !orderPayment || orderPayment.provider !== 'paystack') {
      return NextResponse.json(
        { success: false, message: "This order has no online payment to complete" },
        { status: 400 }
      );
    }

    if (orderPayment.status === 'completed') {
      return NextResponse.json({ success: false, message: "This order has already been paid" }, { status: 400 });
    }

    // Read the already-computed split from orders/create -- never
    // recompute amounts here, only build the Paystack payload from what
    // was already persisted.
    const { data: splits, error: splitsError } = await supabaseAdmin
      .from('order_payment_splits')
      .select('*')
      .eq('order_payment_id', orderPayment.id);

    if (splitsError || !splits || splits.length === 0) {
      return NextResponse.json(
        { success: false, message: "Payment setup for this order is incomplete. Please contact support." },
        { status: 400 }
      );
    }

    const customer = await findCustomerById(customerId);
    if (!customer?.email) {
      return NextResponse.json({ success: false, message: "An email address is required to pay online" }, { status: 400 });
    }

    // Atomic claim against a double-click/multi-tab race: order_payments
    // has one row per order (order_id is UNIQUE), so this single
    // conditional UPDATE is the lock -- Postgres serializes concurrent
    // UPDATEs against the same row and re-checks the WHERE clause against
    // the post-lock state, so only one concurrent request's WHERE can ever
    // match; the other gets 0 rows back. A plain read-then-decide check
    // here wouldn't actually be atomic and could itself race.
    // The claim itself must change `reference` (not just `updated_at`) --
    // otherwise a second concurrent request re-evaluating `reference IS
    // NULL` after the first claim's lock releases would still see NULL
    // (untouched) and wrongly win too. The placeholder is overwritten
    // below with the real Paystack reference once initialize succeeds; if
    // it doesn't, the placeholder itself expires the same way a real one
    // would, via the updated_at-age branch, so a retry isn't stuck forever.
    const claimCutoff = new Date(Date.now() - 15_000).toISOString();
    const claimPlaceholder = `claiming_${orderPayment.id}_${Date.now()}`;
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('order_payments')
      .update({ reference: claimPlaceholder, updated_at: new Date().toISOString() })
      .eq('id', orderPayment.id)
      .eq('status', 'pending')
      .or(`reference.is.null,updated_at.lt.${claimCutoff}`)
      .select()
      .maybeSingle();

    if (claimError) {
      console.error('Error claiming payment initiation lock:', claimError);
      return NextResponse.json({ success: false, message: "Could not start payment. Please try again." }, { status: 500 });
    }
    if (!claimed) {
      return NextResponse.json({ success: false, message: "A payment is already being started for this order. Please wait a few seconds and try again." }, { status: 409 });
    }

    // Flat shares: each subaccount gets exactly net_amount_to_vendor
    // (already has the platform commission subtracted), not a re-derived
    // percentage -- the unassigned remainder (the commission) implicitly
    // goes to Stora's main account, per bearer_type: 'account' below.
    const subaccounts = splits.map(split => ({
      subaccount: split.subaccount_code,
      share: Math.round(parseFloat(split.net_amount_to_vendor) * 100)
    }));

    const amountKobo = Math.round(parseFloat(orderPayment.amount) * 100);
    const reference = `pay_${order.id}_${Date.now()}`;

    let transaction;
    try {
      transaction = await initializeTransaction({
        email: customer.email,
        amountKobo,
        reference,
        split: {
          type: 'flat',
          bearer_type: 'account',
          subaccounts
        },
        metadata: {
          order_id: order.id,
          order_number: order.order_number
        }
      });
    } catch (error) {
      console.error('Paystack transaction initialize error:', error);
      return NextResponse.json({ success: false, message: "Could not start payment. Please try again." }, { status: 502 });
    }

    const { error: refUpdateError } = await supabaseAdmin
      .from('order_payments')
      .update({ reference, updated_at: new Date().toISOString() })
      .eq('id', orderPayment.id);

    if (refUpdateError) {
      console.error('Error saving payment reference:', refUpdateError);
    }

    return NextResponse.json({
      success: true,
      accessCode: transaction.access_code,
      reference: transaction.reference,
      publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
