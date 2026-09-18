import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { captureServerEvent } from '@/lib/posthog-server';
import { resolveListingStoreByOwner, upsertSubscriptionTransaction, getLatestPendingTransactionReference } from '@/lib/listingSubscription';
import {
  getLatestPendingFullStoreTransactionReference,
  resolveFullStoreByOwner,
  upsertFullStoreSubscriptionTransaction
} from '@/lib/fullStoreSubscription';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
// Plan code for the ₦500/month listing subscription -- create this once in
// the Paystack dashboard and store the resulting plan_code here.
const LISTING_PLAN_CODE = process.env.PAYSTACK_LISTING_PLAN_CODE;
const FULL_STORE_PLAN_CODE = process.env.PAYSTACK_FULL_STORE_PLAN_CODE;
const FULL_STORE_DEFAULT_AMOUNT_KOBO = Number(process.env.PAYSTACK_FULL_STORE_AMOUNT_KOBO || 0) || null;
const LISTING_DEFAULT_AMOUNT_KOBO = 50000;

async function paystackRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok || data.status === false) {
    const err = new Error(data.message || `Paystack error: ${res.status}`);
    err.paystackResponse = data;
    throw err;
  }
  return data.data;
}

// POST /api/subscription/initialize
// Starts a Paystack transaction that, on completion, creates a subscription.
// Returns { authorizationUrl, reference } for frontend redirect and fallback
// confirmation when callback params are not available anymore.
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const { data: ownerStore } = await supabaseAdmin
      .from('stores')
      .select('id, owner_id, platform_mode, subscription_status, full_store_subscription_status')
      .eq('owner_id', user.id)
      .single();

    if (!ownerStore) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.stora.com.ng';

    if (ownerStore.platform_mode === 'listing') {
      const store = await resolveListingStoreByOwner(user.id);
      if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

      if (store.subscription_status === 'active') {
        return NextResponse.json({ success: false, message: 'Already subscribed' }, { status: 409 });
      }

      if (!LISTING_PLAN_CODE) {
        return NextResponse.json({ success: false, message: 'Listing subscription plan not configured -- contact support' }, { status: 503 });
      }

      const result = await paystackRequest('/transaction/initialize', {
        method: 'POST',
        body: {
          email: user.email,
          amount: 50000, // ₦500 in kobo -- Paystack creates the subscription on success
          plan: LISTING_PLAN_CODE,
          metadata: {
            store_id: store.id,
            user_id: user.id,
            purpose: 'listing_subscription'
          },
          callback_url: `${appUrl}/dashboard/subscription?status=success`
        }
      });

      await upsertSubscriptionTransaction({
        storeId: store.id,
        ownerId: user.id,
        reference: result.reference,
        status: 'initialized',
        amountKobo: 50000,
        currency: 'NGN',
        authorizationUrl: result.authorization_url,
        providerPlanCode: LISTING_PLAN_CODE
      });

      await captureServerEvent(user.id, 'subscription_initialize', {
        subscriptionMode: 'listing',
        storeId: store.id,
        planCode: LISTING_PLAN_CODE,
        reference: result.reference || null
      });

      return NextResponse.json({
        success: true,
        authorizationUrl: result.authorization_url,
        reference: result.reference || null
      });
    }

    const fullStore = await resolveFullStoreByOwner(user.id);
    if (!fullStore) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    if (fullStore.full_store_subscription_status === 'active') {
      return NextResponse.json({ success: false, message: 'Already subscribed' }, { status: 409 });
    }

    if (!FULL_STORE_PLAN_CODE) {
      return NextResponse.json({ success: false, message: 'Full-store subscription plan not configured -- contact support' }, { status: 503 });
    }

    const result = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: {
        email: user.email,
        ...(FULL_STORE_DEFAULT_AMOUNT_KOBO ? { amount: FULL_STORE_DEFAULT_AMOUNT_KOBO } : {}),
        plan: FULL_STORE_PLAN_CODE,
        metadata: {
          store_id: fullStore.id,
          user_id: user.id,
          purpose: 'full_store_subscription'
        },
        callback_url: `${appUrl}/dashboard/subscription?status=success`
      }
    });

    await upsertFullStoreSubscriptionTransaction({
      storeId: fullStore.id,
      ownerId: user.id,
      reference: result.reference,
      status: 'initialized',
      amountKobo: FULL_STORE_DEFAULT_AMOUNT_KOBO,
      currency: 'NGN',
      authorizationUrl: result.authorization_url,
      providerPlanCode: FULL_STORE_PLAN_CODE
    });

    await captureServerEvent(user.id, 'subscription_initialize', {
      subscriptionMode: 'full_store',
      storeId: fullStore.id,
      planCode: FULL_STORE_PLAN_CODE,
      reference: result.reference || null
    });

    return NextResponse.json({
      success: true,
      authorizationUrl: result.authorization_url,
      reference: result.reference || null
    });
  } catch (error) {
    console.error('Subscription initialize error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to start subscription' }, { status: 500 });
  }
}

// GET /api/subscription -- return the authenticated store's subscription status
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, platform_mode, subscription_status, subscription_paystack_code, subscription_next_payment_date, full_store_subscription_status, full_store_subscription_paystack_code, full_store_subscription_next_payment_date, full_store_subscription_grace_ends_at, full_store_subscription_locked_at')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    const isListing = store.platform_mode === 'listing';
    const pendingReference = isListing
      ? await getLatestPendingTransactionReference(store.id)
      : await getLatestPendingFullStoreTransactionReference(store.id);

    const currentStatus = isListing ? store.subscription_status : store.full_store_subscription_status;
    const currentPaystackCode = isListing ? store.subscription_paystack_code : store.full_store_subscription_paystack_code;
    const currentNextPaymentDate = isListing ? store.subscription_next_payment_date : store.full_store_subscription_next_payment_date;

    return NextResponse.json({
      success: true,
      data: {
        platformMode: store.platform_mode,
        subscriptionStatus: currentStatus,
        subscriptionPaystackCode: currentPaystackCode,
        subscriptionNextPaymentDate: currentNextPaymentDate,
        subscriptionAmountKobo: isListing ? LISTING_DEFAULT_AMOUNT_KOBO : FULL_STORE_DEFAULT_AMOUNT_KOBO,
        listingSubscriptionStatus: store.subscription_status,
        listingSubscriptionNextPaymentDate: store.subscription_next_payment_date,
        listingSubscriptionAmountKobo: LISTING_DEFAULT_AMOUNT_KOBO,
        fullStoreSubscriptionStatus: store.full_store_subscription_status,
        fullStoreSubscriptionNextPaymentDate: store.full_store_subscription_next_payment_date,
        fullStoreSubscriptionAmountKobo: FULL_STORE_DEFAULT_AMOUNT_KOBO,
        fullStoreSubscriptionGraceEndsAt: store.full_store_subscription_grace_ends_at,
        fullStoreSubscriptionLockedAt: store.full_store_subscription_locked_at,
        pendingReference
      }
    });
  } catch (error) {
    console.error('Subscription GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
