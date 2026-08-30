import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { findCustomerById } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { initializeTransaction, verifyTransaction } from "@/lib/paystack";
import { confirmOrderPayment } from "@/lib/supabasePayments";
import { isVendorSubdomainHost } from "@/lib/apexDomain";
import { resolveRequestHost } from "@/lib/vendorHost";

export async function POST(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { orderId, returnPath } = await request.json();
    if (!orderId) {
      return NextResponse.json({ success: false, message: "Order ID is required" }, { status: 400 });
    }

    // Never trust a client-supplied absolute URL for where Paystack redirects
    // back to -- only a same-origin relative path is accepted, built into a
    // full URL against our own known origin below. A bare "/" prefix check
    // alone would still let "//evil.com" (protocol-relative) or
    // "/x://evil.com" through, so both are rejected explicitly, along with
    // any backslash (browsers normalize \ to / when resolving a URL, so
    // "/\evil.com" parses the same as "//evil.com" if this were ever handed
    // to a browser bare -- callbackOrigin below always prefixes a real
    // origin first so that specific trick isn't reachable today, but this
    // guards the same class of bug google/start/route.js's isSafeReturnTo
    // had to fix directly.
    const isSafeReturnPath = typeof returnPath === 'string'
      && returnPath.startsWith('/')
      && !returnPath.startsWith('//')
      && !returnPath.includes('\\')
      && !returnPath.includes('://');
    if (!isSafeReturnPath) {
      return NextResponse.json({ success: false, message: "Invalid return path" }, { status: 400 });
    }

    // /orders is one of proxy.js's permanently subdomain-rewrite-exempt
    // paths, so returnPath is always bare there regardless of host -- but
    // the customer still needs to land back on whichever host they actually
    // checked out from, vendor subdomain or apex.
    const requestHost = resolveRequestHost(request);
    const callbackOrigin = isVendorSubdomainHost(requestHost) ? `https://${requestHost}` : process.env.NEXT_PUBLIC_APP_URL;

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

    // A previous initiate call may already have produced a reference that's
    // still live on Paystack's side (mid-transfer, or genuinely succeeded but
    // never made it back here via webhook/verify) -- generating a fresh
    // reference below would silently orphan it: once overwritten, the old
    // reference can no longer be looked up, so a webhook or verify call for
    // it finds no matching row and the payment is lost even though Paystack
    // already settled the money. Check with Paystack first and only ever
    // rotate the reference once it's confirmed genuinely dead.
    const isRealReference = orderPayment.reference && !orderPayment.reference.startsWith('claiming_');
    if (isRealReference) {
      let existingTransaction;
      try {
        existingTransaction = await verifyTransaction(orderPayment.reference);
      } catch (verifyError) {
        console.error('Could not verify previous payment attempt before re-initiating:', verifyError);
        return NextResponse.json({ success: false, message: "Could not confirm your previous payment attempt. Please wait a moment and try again." }, { status: 409 });
      }

      if (existingTransaction.status === 'success') {
        const result = await confirmOrderPayment(orderPayment.reference, {
          transactionId: String(existingTransaction.id),
          amountKobo: existingTransaction.amount
        });
        return NextResponse.json({
          success: true,
          alreadyPaid: true,
          orderId: order.id,
          needsReconciliation: result.needsReconciliation || false
        });
      }

      if (!['abandoned', 'failed'].includes(existingTransaction.status)) {
        // Still ongoing/queued/pending on Paystack's side -- not safe to
        // rotate the reference out from under a transaction that might
        // still complete.
        return NextResponse.json({ success: false, message: "A previous payment attempt for this order may still be processing. Please wait a moment and try again." }, { status: 409 });
      }
      // Only 'abandoned'/'failed' falls through to generate a fresh reference below.
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
    // goes to Stora's main account.
    const subaccounts = splits.map(split => ({
      subaccount: split.subaccount_code,
      share: Math.round(parseFloat(split.net_amount_to_vendor) * 100)
    }));

    // bearer_type: 'account' (Stora's main account absorbing Paystack's own
    // processing fee) made the merchant's leftover share go negative on
    // anything below roughly NGN27-28k -- at a 2% commission, Paystack's
    // ~1.5%+NGN100 fee routinely exceeds Stora's entire cut, and Paystack
    // rejects the whole split outright when that happens ("Merchant share
    // cannot be lower than zero"), so checkout couldn't even generate a
    // charge for most real order sizes. 'subaccount' + bearer_subaccount
    // moves that cost to the vendor instead, so Stora's commission is never
    // at risk of going negative. For the (common) single-vendor case this
    // is exact. Paystack has no "split the fee across subaccounts only,
    // excluding the merchant" mode -- bearer_subaccount always names ONE
    // subaccount to absorb the whole fee -- so on the rarer combined
    // multi-vendor checkout, the largest-share vendor is picked to absorb
    // it, which is the least-distorting approximation available, not an
    // exact fair split.
    const bearerSplit = splits.reduce((largest, s) =>
      parseFloat(s.net_amount_to_vendor) > parseFloat(largest.net_amount_to_vendor) ? s : largest
    );

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
          bearer_type: 'subaccount',
          bearer_subaccount: bearerSplit.subaccount_code,
          subaccounts
        },
        metadata: {
          order_id: order.id,
          order_number: order.order_number
        },
        // Paystack's own hosted checkout page owns the entire payment UI
        // from here -- including waiting out a slow channel like bank
        // transfer -- and redirects the browser back here once the
        // customer's done (with ?reference= appended). The order page
        // picks that up and calls /api/payments/verify. This is never
        // trusted as proof of payment on its own, same as the webhook.
        //
        // Built against the ORIGINATING host, not always the static apex --
        // a customer checking out from a vendor subdomain must come back to
        // that same subdomain, same reasoning as google/start/route.js's
        // callbackURL (this route isn't behind proxy.js's page rewrite --
        // /orders is one of its permanently-exempt paths -- but it's still
        // the real host the browser is sitting on either way).
        callbackUrl: `${callbackOrigin}${returnPath}`
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
      authorizationUrl: transaction.authorization_url,
      reference: transaction.reference
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
