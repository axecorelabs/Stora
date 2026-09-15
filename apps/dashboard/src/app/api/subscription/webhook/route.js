import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  applyListingActiveState,
  applyListingInactiveState,
  completeWebhookEvent,
  failWebhookEvent,
  findStoreByTransactionReference,
  registerWebhookEvent,
  resolveListingStoreByCustomerEmail,
  upsertSubscriptionTransaction
} from '@/lib/listingSubscription';

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

  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const providerEventKey = `${eventType}:${data?.id || data?.reference || data?.subscription_code || payloadHash}`;

  const webhookEvent = await registerWebhookEvent({
    providerEventKey,
    eventType,
    payloadHash,
    payload: event
  });

  if (webhookEvent.duplicate) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  try {
    let storeContext = null;

    if (data?.reference) {
      storeContext = await findStoreByTransactionReference(data.reference);
    }

    if (!storeContext && data?.metadata?.store_id) {
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('id, owner_id')
        .eq('id', data.metadata.store_id)
        .eq('platform_mode', 'listing')
        .maybeSingle();
      if (store) storeContext = { storeId: store.id, ownerId: store.owner_id };
    }

    if (!storeContext && data?.subscription_code) {
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('id, owner_id')
        .eq('subscription_paystack_code', data.subscription_code)
        .eq('platform_mode', 'listing')
        .maybeSingle();
      if (store) storeContext = { storeId: store.id, ownerId: store.owner_id };
    }

    if (!storeContext) {
      const store = await resolveListingStoreByCustomerEmail(data?.customer?.email);
      if (store) storeContext = { storeId: store.id, ownerId: store.owner_id };
    }

    // subscription.create: fired when a new subscription is created after the
    // first successful charge.
    if (eventType === 'subscription.create' && storeContext) {
      await applyListingActiveState({
        storeId: storeContext.storeId,
        ownerId: storeContext.ownerId,
        subscriptionCode: data.subscription_code || null,
        nextPaymentDate: data.next_payment_date || null,
        customerCode: data?.customer?.customer_code || null,
        planCode: data?.plan?.plan_code || data?.plan_object?.plan_code || null,
        paidAt: null,
        raw: data
      });
    }

    // charge.success: captures successful one-off and recurring subscription charges.
    if (eventType === 'charge.success') {
      const listingPlanCode = process.env.PAYSTACK_LISTING_PLAN_CODE;
      const planCode = data?.plan?.plan_code || data?.plan_object?.plan_code || null;
      const isListingPlan = listingPlanCode ? planCode === listingPlanCode : data?.metadata?.purpose === 'listing_subscription';

      if (storeContext) {
        await upsertSubscriptionTransaction({
          storeId: storeContext.storeId,
          ownerId: storeContext.ownerId,
          reference: data?.reference,
          status: data?.status === 'success' ? 'success' : 'pending',
          amountKobo: data?.amount ?? null,
          currency: data?.currency ?? null,
          providerTransactionId: data?.id ? String(data.id) : null,
          providerSubscriptionCode: data?.subscription_code || null,
          providerCustomerCode: data?.customer?.customer_code || null,
          providerPlanCode: planCode,
          paidAt: data?.paid_at || null,
          verificationPayload: data
        });
      }

      if (isListingPlan && storeContext) {
        const nextPaymentDate = data?.paid_at
          ? new Date(new Date(data.paid_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;

        await applyListingActiveState({
          storeId: storeContext.storeId,
          ownerId: storeContext.ownerId,
          subscriptionCode: data?.subscription_code || null,
          nextPaymentDate,
          customerCode: data?.customer?.customer_code || null,
          planCode,
          paidAt: data?.paid_at || null,
          raw: data
        });
      }
    }

    // subscription.disable / subscription.not_renew: payment failed or vendor cancelled.
    if ((eventType === 'subscription.disable' || eventType === 'subscription.not_renew') && storeContext) {
      const newStatus = eventType === 'subscription.not_renew' ? 'cancelled' : 'past_due';
      await applyListingInactiveState({
        storeId: storeContext.storeId,
        ownerId: storeContext.ownerId,
        status: newStatus,
        subscriptionCode: data?.subscription_code || null,
        cancelledAt: newStatus === 'cancelled' ? new Date().toISOString() : null,
        raw: data
      });

      if (data?.reference) {
        await upsertSubscriptionTransaction({
          storeId: storeContext.storeId,
          ownerId: storeContext.ownerId,
          reference: data.reference,
          status: newStatus === 'cancelled' ? 'abandoned' : 'failed',
          providerSubscriptionCode: data?.subscription_code || null,
          verificationPayload: data
        });
      }
    }

    await completeWebhookEvent(webhookEvent.id);
  } catch (error) {
    await failWebhookEvent(webhookEvent.id, error?.message || 'Webhook processing error');
    console.error('Subscription webhook processing error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  // Always 200 -- Paystack retries on non-2xx.
  return NextResponse.json({ success: true });
}
