import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { captureServerEvent } from '@/lib/posthog-server';
import { resolveListingStoreByOwner, upsertSubscriptionTransaction, getLatestPendingTransactionReference } from '@/lib/listingSubscription';
import {
  getLatestPendingFullStoreTransactionReference,
  resolveFullStoreByOwner,
  upsertFullStoreSubscriptionTransaction,
  getFullStoreEnforcementStartMs
} from '@/lib/fullStoreSubscription';
import { LISTING_PLAN_CONFIG, isValidListingCycle, listingCycleSavingsPercent } from '@/lib/listingSubscriptionPlans';
import { FULL_STORE_PLAN_CONFIG, isValidFullStoreCycle, fullStoreCycleSavingsPercent } from '@/lib/fullStoreSubscriptionPlans';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

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

      const body = await req.json().catch(() => ({}));
      const cycle = isValidListingCycle(body.cycle) ? body.cycle : 'monthly';
      const plan = LISTING_PLAN_CONFIG[cycle];

      if (!plan.planCode || !plan.amountKobo) {
        return NextResponse.json({ success: false, message: 'This billing option is not available yet -- contact support' }, { status: 503 });
      }

      const result = await paystackRequest('/transaction/initialize', {
        method: 'POST',
        body: {
          email: user.email,
          amount: plan.amountKobo,
          plan: plan.planCode,
          metadata: {
            store_id: store.id,
            user_id: user.id,
            purpose: 'listing_subscription',
            billing_cycle: cycle
          },
          callback_url: `${appUrl}/dashboard/subscription?status=success`
        }
      });

      await upsertSubscriptionTransaction({
        storeId: store.id,
        ownerId: user.id,
        reference: result.reference,
        status: 'initialized',
        amountKobo: plan.amountKobo,
        currency: 'NGN',
        authorizationUrl: result.authorization_url,
        providerPlanCode: plan.planCode,
        billingCycle: cycle
      });

      await captureServerEvent(user.id, 'subscription_initialize', {
        subscriptionMode: 'listing',
        storeId: store.id,
        planCode: plan.planCode,
        billingCycle: cycle,
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

    const fsBody = await req.json().catch(() => ({}));
    const fsCycle = isValidFullStoreCycle(fsBody.cycle) ? fsBody.cycle : 'monthly';
    const fsPlan = FULL_STORE_PLAN_CONFIG[fsCycle];

    if (!fsPlan.planCode || !fsPlan.amountKobo) {
      return NextResponse.json({ success: false, message: 'This billing option is not available yet -- contact support' }, { status: 503 });
    }

    const result = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: {
        email: user.email,
        amount: fsPlan.amountKobo,
        plan: fsPlan.planCode,
        metadata: {
          store_id: fullStore.id,
          user_id: user.id,
          purpose: 'full_store_subscription',
          billing_cycle: fsCycle
        },
        callback_url: `${appUrl}/dashboard/subscription?status=success`
      }
    });

    await upsertFullStoreSubscriptionTransaction({
      storeId: fullStore.id,
      ownerId: user.id,
      reference: result.reference,
      status: 'initialized',
      amountKobo: fsPlan.amountKobo,
      currency: 'NGN',
      authorizationUrl: result.authorization_url,
      providerPlanCode: fsPlan.planCode,
      billingCycle: fsCycle
    });

    await captureServerEvent(user.id, 'subscription_initialize', {
      subscriptionMode: 'full_store',
      storeId: fullStore.id,
      planCode: fsPlan.planCode,
      billingCycle: fsCycle,
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
      .select('id, platform_mode, subscription_status, subscription_paystack_code, subscription_next_payment_date, subscription_billing_cycle, full_store_subscription_status, full_store_subscription_paystack_code, full_store_subscription_next_payment_date, full_store_subscription_grace_ends_at, full_store_subscription_locked_at, full_store_subscription_billing_cycle')
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
    // A subscriber (either product) can be on any of several cycles --
    // report what they're actually billed, not always the base figure.
    const activeListingCycle = store.subscription_billing_cycle || 'monthly';
    const currentListingAmountKobo = LISTING_PLAN_CONFIG[activeListingCycle]?.amountKobo || LISTING_PLAN_CONFIG.monthly.amountKobo;
    const activeFullStoreCycle = store.full_store_subscription_billing_cycle || 'monthly';
    const currentFullStoreAmountKobo = FULL_STORE_PLAN_CONFIG[activeFullStoreCycle]?.amountKobo || FULL_STORE_PLAN_CONFIG.monthly.amountKobo;

    // One server-computed source for pricing/savings -- both the onboarding
    // wizard's subscribe step and /dashboard/subscription render their cycle
    // picker from this instead of hardcoding percentages in two places.
    const listingPlans = Object.fromEntries(
      Object.entries(LISTING_PLAN_CONFIG).map(([cycle, plan]) => [
        cycle,
        { amountKobo: plan.amountKobo, label: plan.label, savingsPercent: listingCycleSavingsPercent(cycle), available: !!(plan.planCode && plan.amountKobo) }
      ])
    );
    const fullStorePlans = Object.fromEntries(
      Object.entries(FULL_STORE_PLAN_CONFIG).map(([cycle, plan]) => [
        cycle,
        { amountKobo: plan.amountKobo, label: plan.label, savingsPercent: fullStoreCycleSavingsPercent(cycle), available: !!(plan.planCode && plan.amountKobo) }
      ])
    );

    return NextResponse.json({
      success: true,
      data: {
        platformMode: store.platform_mode,
        subscriptionStatus: currentStatus,
        subscriptionPaystackCode: currentPaystackCode,
        subscriptionNextPaymentDate: currentNextPaymentDate,
        subscriptionAmountKobo: isListing ? currentListingAmountKobo : currentFullStoreAmountKobo,
        billingCycle: isListing ? store.subscription_billing_cycle : store.full_store_subscription_billing_cycle,
        listingPlans,
        fullStorePlans,
        listingSubscriptionStatus: store.subscription_status,
        listingSubscriptionNextPaymentDate: store.subscription_next_payment_date,
        listingSubscriptionAmountKobo: currentListingAmountKobo,
        fullStoreSubscriptionStatus: store.full_store_subscription_status,
        fullStoreSubscriptionNextPaymentDate: store.full_store_subscription_next_payment_date,
        fullStoreSubscriptionAmountKobo: currentFullStoreAmountKobo,
        fullStoreSubscriptionBillingCycle: store.full_store_subscription_billing_cycle,
        // Single source of truth for the enforcement date -- read from
        // here (not hardcoded a second time) by the login-time reminder
        // modal, so it can never drift from fullStoreSubscription.js's
        // own real enforcement logic.
        fullStoreEnforcementStartsAt: new Date(getFullStoreEnforcementStartMs()).toISOString(),
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
