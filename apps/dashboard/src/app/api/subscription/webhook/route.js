import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Paystack sends this header; we verify it with HMAC-SHA512 of the raw body
// using our secret key -- same pattern as store app's order webhook.
function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signatureHeader, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const { event: eventType, data } = event;

  // subscription.create: fired when a new subscription is created after the
  // first successful charge. This is our primary activation trigger.
  if (eventType === 'subscription.create') {
    const storeId = data?.metadata?.store_id;
    if (storeId) {
      await supabaseAdmin
        .from('stores')
        .update({
          subscription_status: 'active',
          subscription_paystack_code: data.subscription_code,
          subscription_next_payment_date: data.next_payment_date
        })
        .eq('id', storeId)
        .eq('platform_mode', 'listing');
    }
  }

  // charge.success: fires on every successful recurring charge. Update
  // next_payment_date so the dashboard keeps it accurate.
  if (eventType === 'charge.success' && data?.plan?.plan_code === process.env.PAYSTACK_LISTING_PLAN_CODE) {
    const subscriptionCode = data?.subscription_code;
    if (subscriptionCode) {
      // Look up by subscription code -- the store_id isn't always in charge.success metadata.
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('id')
        .eq('subscription_paystack_code', subscriptionCode)
        .maybeSingle();

      if (store) {
        await supabaseAdmin
          .from('stores')
          .update({
            subscription_status: 'active',
            subscription_next_payment_date: data.paid_at
              ? new Date(new Date(data.paid_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
              : null
          })
          .eq('id', store.id);
      }
    }
  }

  // subscription.disable / subscription.not_renew: payment failed or vendor cancelled.
  if (eventType === 'subscription.disable' || eventType === 'subscription.not_renew') {
    const subscriptionCode = data?.subscription_code;
    if (subscriptionCode) {
      const newStatus = eventType === 'subscription.not_renew' ? 'cancelled' : 'past_due';
      await supabaseAdmin
        .from('stores')
        .update({ subscription_status: newStatus })
        .eq('subscription_paystack_code', subscriptionCode)
        .eq('platform_mode', 'listing');
    }
  }

  // Always 200 -- Paystack retries on non-2xx.
  return NextResponse.json({ success: true });
}
