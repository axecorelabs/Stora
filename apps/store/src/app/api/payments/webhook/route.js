import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { confirmOrderPayment, markOrderPaymentFailed } from "@/lib/supabasePayments";

// Paystack calls this directly -- no customer session exists here, so
// signature verification is the *only* trust boundary. Must read the
// raw body (not request.json()) since the signature is computed over
// the exact bytes Paystack sent.
export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('Paystack webhook signature mismatch (possible spoofed request)');
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  try {
    if (payload.event === 'charge.success') {
      const data = payload.data;
      await confirmOrderPayment(data.reference, {
        transactionId: String(data.id),
        amountKobo: data.amount
      });
    } else if (payload.event === 'charge.failed') {
      await markOrderPaymentFailed(payload.data.reference);
    }
  } catch (error) {
    console.error('Error processing Paystack webhook:', error);
    // Still 200 -- Paystack retries on non-2xx, and the idempotent core
    // means a retry is safe; returning 500 here would just cause
    // unnecessary retry storms for an error that a retry won't fix.
  }

  return NextResponse.json({ success: true });
}
