import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
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

    // invoice.payment_failed nests the subscription under data.subscription
    // (data itself is the invoice), unlike subscription.create/disable/
    // not_renew where data IS the subscription -- check both shapes.
    const subscriptionCode = data?.subscription_code || data?.subscription?.subscription_code || null;
    const planCode = data?.plan?.plan_code || data?.plan_object?.plan_code
      || data?.subscription?.plan?.plan_code || data?.subscription?.plan_object?.plan_code || null;
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

    if (!storeContext && subscriptionCode) {
      if (subscriptionKind === 'full_store') {
        const { data: store } = await supabaseAdmin
          .from('stores')
          .select('id, owner_id')
          .eq('full_store_subscription_paystack_code', subscriptionCode)
          .eq('platform_mode', 'store')
          .maybeSingle();
        if (store) storeContext = { storeId: store.id, ownerId: store.owner_id };
      } else if (subscriptionKind === 'listing') {
        const { data: store } = await supabaseAdmin
          .from('stores')
          .select('id, owner_id')
          .eq('subscription_paystack_code', subscriptionCode)
          .eq('platform_mode', 'listing')
          .maybeSingle();
        if (store) storeContext = { storeId: store.id, ownerId: store.owner_id };
      } else {
        const { data: listingStore } = await supabaseAdmin
          .from('stores')
          .select('id, owner_id')
          .eq('subscription_paystack_code', subscriptionCode)
          .eq('platform_mode', 'listing')
          .maybeSingle();

        if (listingStore) {
          storeContext = { storeId: listingStore.id, ownerId: listingStore.owner_id };
          subscriptionKind = 'listing';
        } else {
          const { data: fullStore } = await supabaseAdmin
            .from('stores')
            .select('id, owner_id')
            .eq('full_store_subscription_paystack_code', subscriptionCode)
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

        await captureServerEvent(storeContext.ownerId, 'subscription_confirmed', {
          source: 'webhook',
          subscriptionMode: 'listing',
          storeId: storeContext.storeId,
          reference: data?.reference || null,
          providerPlanCode: planCode || null,
          nextPaymentDate: nextPaymentDate || null
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

        await captureServerEvent(storeContext.ownerId, 'subscription_confirmed', {
          source: 'webhook',
          subscriptionMode: 'full_store',
          storeId: storeContext.storeId,
          reference: data?.reference || null,
          providerPlanCode: planCode || null,
          nextPaymentDate: nextPaymentDate || null
        });
      }
    }

    // subscription.disable / subscription.not_renew: both are steps of the
    // SAME cancellation lifecycle, per Paystack's docs -- not_renew fires
    // immediately when a cancellation is requested ("won't be charged next
    // cycle"), and disable fires later, on the actual next payment date, as
    // that same cancellation's final deactivation (also sent when a
    // fixed-cycle plan completes all its billing cycles). Neither means a
    // renewal charge failed -- that's invoice.payment_failed, handled
    // separately below. Both used to map here as if one meant "cancelled"
    // and the other "past_due with a grace period," which let a store that
    // had already been correctly cancelled by not_renew get "resurrected"
    // into a fresh grace window (with commerce access restored) when the
    // delayed disable event for that same cancellation arrived.
    if ((eventType === 'subscription.disable' || eventType === 'subscription.not_renew') && storeContext) {
      const newStatus = 'cancelled';
      const inactivePayload = {
        storeId: storeContext.storeId,
        ownerId: storeContext.ownerId,
        status: newStatus,
        subscriptionCode,
        cancelledAt: new Date().toISOString(),
        raw: data
      };

      if (subscriptionKind === 'full_store') {
        await applyFullStoreInactiveState(inactivePayload);
      } else {
        await applyListingInactiveState(inactivePayload);
      }

      await captureServerEvent(storeContext.ownerId, 'subscription_suspended', {
        source: 'webhook',
        subscriptionMode: subscriptionKind === 'full_store' ? 'full_store' : 'listing',
        storeId: storeContext.storeId,
        providerSubscriptionCode: subscriptionCode,
        webhookEvent: eventType,
        status: newStatus
      });

      if (data?.reference) {
        const failedTxPayload = {
          storeId: storeContext.storeId,
          ownerId: storeContext.ownerId,
          reference: data.reference,
          status: 'abandoned',
          providerSubscriptionCode: subscriptionCode,
          verificationPayload: data
        };

        if (subscriptionKind === 'full_store') {
          await upsertFullStoreSubscriptionTransaction(failedTxPayload);
        } else {
          await upsertSubscriptionTransaction(failedTxPayload);
        }
      }
    }

    // invoice.payment_failed: an actual renewal charge failure -- the real
    // "past due" trigger (see the comment above; subscription.disable and
    // subscription.not_renew are cancellation events, not this). For a
    // full-store account this starts (or, on a later Paystack retry,
    // refreshes) the grace window in applyFullStoreInactiveState; for a
    // listing account there's no grace window yet, so this hides the
    // listing the same way an outright cancellation already does.
    if (eventType === 'invoice.payment_failed' && storeContext) {
      const failedPayload = {
        storeId: storeContext.storeId,
        ownerId: storeContext.ownerId,
        status: 'past_due',
        subscriptionCode,
        cancelledAt: null,
        raw: data
      };

      if (subscriptionKind === 'full_store') {
        await applyFullStoreInactiveState(failedPayload);
      } else {
        await applyListingInactiveState(failedPayload);
      }

      await captureServerEvent(storeContext.ownerId, 'subscription_renewal_failed', {
        source: 'webhook',
        subscriptionMode: subscriptionKind === 'full_store' ? 'full_store' : 'listing',
        storeId: storeContext.storeId,
        providerSubscriptionCode: subscriptionCode,
        webhookEvent: eventType,
        status: 'past_due'
      });
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
