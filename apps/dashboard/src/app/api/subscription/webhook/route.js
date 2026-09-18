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
import {
  applyFullStoreActiveState,
  applyFullStoreInactiveState,
  findFullStoreByTransactionReference,
  resolveFullStoreByCustomerEmail,
  upsertFullStoreSubscriptionTransaction
} from '@/lib/fullStoreSubscription';

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
    let subscriptionKind = null;

    const planCode = data?.plan?.plan_code || data?.plan_object?.plan_code || null;
    const listingPlanCode = process.env.PAYSTACK_LISTING_PLAN_CODE;
    const fullStorePlanCode = process.env.PAYSTACK_FULL_STORE_PLAN_CODE;

    if (listingPlanCode && planCode === listingPlanCode) subscriptionKind = 'listing';
    if (fullStorePlanCode && planCode === fullStorePlanCode) subscriptionKind = 'full_store';
    if (!subscriptionKind && data?.metadata?.purpose === 'listing_subscription') subscriptionKind = 'listing';
    if (!subscriptionKind && data?.metadata?.purpose === 'full_store_subscription') subscriptionKind = 'full_store';

    if (data?.reference) {
      if (subscriptionKind === 'full_store') {
        storeContext = await findFullStoreByTransactionReference(data.reference);
      } else if (subscriptionKind === 'listing') {
        storeContext = await findStoreByTransactionReference(data.reference);
      } else {
        storeContext = await findStoreByTransactionReference(data.reference);
        if (storeContext) {
          subscriptionKind = 'listing';
        } else {
          storeContext = await findFullStoreByTransactionReference(data.reference);
          if (storeContext) subscriptionKind = 'full_store';
        }
      }
    }

    if (!storeContext && data?.metadata?.store_id) {
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('id, owner_id, platform_mode')
        .eq('id', data.metadata.store_id)
        .maybeSingle();
      if (store) {
        storeContext = { storeId: store.id, ownerId: store.owner_id };
        if (!subscriptionKind) {
          subscriptionKind = store.platform_mode === 'listing' ? 'listing' : 'full_store';
        }
      }
    }

    if (!storeContext && data?.subscription_code) {
      if (subscriptionKind === 'full_store') {
        const { data: store } = await supabaseAdmin
          .from('stores')
          .select('id, owner_id')
          .eq('full_store_subscription_paystack_code', data.subscription_code)
          .eq('platform_mode', 'store')
          .maybeSingle();
        if (store) storeContext = { storeId: store.id, ownerId: store.owner_id };
      } else if (subscriptionKind === 'listing') {
        const { data: store } = await supabaseAdmin
          .from('stores')
          .select('id, owner_id')
          .eq('subscription_paystack_code', data.subscription_code)
          .eq('platform_mode', 'listing')
          .maybeSingle();
        if (store) storeContext = { storeId: store.id, ownerId: store.owner_id };
      } else {
        const { data: listingStore } = await supabaseAdmin
          .from('stores')
          .select('id, owner_id')
          .eq('subscription_paystack_code', data.subscription_code)
          .eq('platform_mode', 'listing')
          .maybeSingle();

        if (listingStore) {
          storeContext = { storeId: listingStore.id, ownerId: listingStore.owner_id };
          subscriptionKind = 'listing';
        } else {
          const { data: fullStore } = await supabaseAdmin
            .from('stores')
            .select('id, owner_id')
            .eq('full_store_subscription_paystack_code', data.subscription_code)
            .eq('platform_mode', 'store')
            .maybeSingle();
          if (fullStore) {
            storeContext = { storeId: fullStore.id, ownerId: fullStore.owner_id };
            subscriptionKind = 'full_store';
          }
        }
      }
    }

    if (!storeContext) {
      if (subscriptionKind === 'full_store') {
        const store = await resolveFullStoreByCustomerEmail(data?.customer?.email);
        if (store) storeContext = { storeId: store.id, ownerId: store.owner_id };
      } else if (subscriptionKind === 'listing') {
        const store = await resolveListingStoreByCustomerEmail(data?.customer?.email);
        if (store) storeContext = { storeId: store.id, ownerId: store.owner_id };
      } else {
        const listingStore = await resolveListingStoreByCustomerEmail(data?.customer?.email);
        if (listingStore) {
          storeContext = { storeId: listingStore.id, ownerId: listingStore.owner_id };
          subscriptionKind = 'listing';
        } else {
          const fullStore = await resolveFullStoreByCustomerEmail(data?.customer?.email);
          if (fullStore) {
            storeContext = { storeId: fullStore.id, ownerId: fullStore.owner_id };
            subscriptionKind = 'full_store';
          }
        }
      }
    }

    // subscription.create: fired when a new subscription is created after the
    // first successful charge.
    if (eventType === 'subscription.create' && storeContext) {
      const activePayload = {
        storeId: storeContext.storeId,
        ownerId: storeContext.ownerId,
        subscriptionCode: data.subscription_code || null,
        nextPaymentDate: data.next_payment_date || null,
        customerCode: data?.customer?.customer_code || null,
        planCode,
        paidAt: null,
        raw: data
      };

      if (subscriptionKind === 'full_store') {
        await applyFullStoreActiveState(activePayload);
      } else {
        await applyListingActiveState(activePayload);
      }
    }

    // charge.success: captures successful one-off and recurring subscription charges.
    if (eventType === 'charge.success') {
      const isListingPlan = listingPlanCode ? planCode === listingPlanCode : data?.metadata?.purpose === 'listing_subscription';
      const isFullStorePlan = fullStorePlanCode ? planCode === fullStorePlanCode : data?.metadata?.purpose === 'full_store_subscription';

      if (!subscriptionKind) {
        if (isListingPlan) subscriptionKind = 'listing';
        if (isFullStorePlan) subscriptionKind = 'full_store';
      }

      if (storeContext) {
        const txPayload = {
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
        };

        if (subscriptionKind === 'full_store') {
          await upsertFullStoreSubscriptionTransaction(txPayload);
        } else {
          await upsertSubscriptionTransaction(txPayload);
        }
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

      if (isFullStorePlan && storeContext) {
        const nextPaymentDate = data?.paid_at
          ? new Date(new Date(data.paid_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;

        await applyFullStoreActiveState({
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
      const inactivePayload = {
        storeId: storeContext.storeId,
        ownerId: storeContext.ownerId,
        status: newStatus,
        subscriptionCode: data?.subscription_code || null,
        cancelledAt: newStatus === 'cancelled' ? new Date().toISOString() : null,
        raw: data
      };

      if (subscriptionKind === 'full_store') {
        await applyFullStoreInactiveState(inactivePayload);
      } else {
        await applyListingInactiveState(inactivePayload);
      }

      if (data?.reference) {
        const failedTxPayload = {
          storeId: storeContext.storeId,
          ownerId: storeContext.ownerId,
          reference: data.reference,
          status: newStatus === 'cancelled' ? 'abandoned' : 'failed',
          providerSubscriptionCode: data?.subscription_code || null,
          verificationPayload: data
        };

        if (subscriptionKind === 'full_store') {
          await upsertFullStoreSubscriptionTransaction(failedTxPayload);
        } else {
          await upsertSubscriptionTransaction(failedTxPayload);
        }
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
