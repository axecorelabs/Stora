import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyTransaction } from "@/lib/paystack";
import { confirmOrderPayment } from "@/lib/supabasePayments";

// Called after the Inline popup closes. The popup's own callback is a UI
// event, not proof of payment -- this is the authoritative server-to-
// server check, same as the webhook path (both share confirmOrderPayment
// so whichever arrives first wins, idempotently).
export async function GET(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');
    if (!reference) {
      return NextResponse.json({ success: false, message: "Reference is required" }, { status: 400 });
    }

    // A customer can only verify their own order's reference.
    const { data: orderPayment, error } = await supabaseAdmin
      .from('order_payments')
      .select('order_id, orders!inner(customer_id)')
      .eq('reference', reference)
      .single();

    if (error || !orderPayment || orderPayment.orders.customer_id !== customerId) {
      return NextResponse.json({ success: false, message: "Payment record not found" }, { status: 404 });
    }

    let transaction;
    try {
      transaction = await verifyTransaction(reference);
    } catch (verifyError) {
      console.error('Paystack transaction verify error:', verifyError);
      return NextResponse.json({ success: false, message: "Could not verify payment" }, { status: 502 });
    }

    if (transaction.status !== 'success') {
      return NextResponse.json({ success: false, status: transaction.status, message: "Payment was not successful" });
    }

    const result = await confirmOrderPayment(reference, {
      transactionId: String(transaction.id),
      amountKobo: transaction.amount
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    if (result.needsReconciliation) {
      // Money moved but the order was auto-cancelled before it landed --
      // don't tell the customer their order is confirmed when the stock
      // that reserved it may already be gone.
      return NextResponse.json({
        success: true,
        orderId: result.orderId,
        needsReconciliation: true,
        message: "We've received your payment, but this order needs a quick check by our team before it's confirmed. We'll be in touch shortly."
      });
    }

    return NextResponse.json({ success: true, orderId: result.orderId });
  } catch (error) {
    console.error('Payment verify error:', error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
