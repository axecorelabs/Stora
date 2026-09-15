import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { resolveListingStoreByOwner, upsertSubscriptionTransaction, getLatestPendingTransactionReference } from '@/lib/listingSubscription';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
// Plan code for the ₦500/month listing subscription -- create this once in
// the Paystack dashboard and store the resulting plan_code here.
const LISTING_PLAN_CODE = process.env.PAYSTACK_LISTING_PLAN_CODE;

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

    const store = await resolveListingStoreByOwner(user.id);

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    if (store.subscription_status === 'active') {
      return NextResponse.json({ success: false, message: 'Already subscribed' }, { status: 409 });
    }

    if (!LISTING_PLAN_CODE) {
      return NextResponse.json({ success: false, message: 'Subscription plan not configured -- contact support' }, { status: 503 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.stora.com.ng';

    const result = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: {
        email: user.email,
        amount: 50000, // ₦500 in kobo -- Paystack creates the subscription on success
        plan: LISTING_PLAN_CODE,
        // Metadata so the webhook can identify the store without the Paystack
        // customer object needing to map 1:1 to a vendor account.
        metadata: {
          store_id: store.id,
          user_id: user.id,
          purpose: 'listing_subscription'
        },
        callback_url: `${appUrl}/dashboard/subscription?status=success`,
        // Cancel URL isn't a Paystack feature -- the callback handles both
        // success and user-abandoned flows based on the transaction status.
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
      .select('id, platform_mode, subscription_status, subscription_paystack_code, subscription_next_payment_date')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    const pendingReference = store.platform_mode === 'listing'
      ? await getLatestPendingTransactionReference(store.id)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        platformMode: store.platform_mode,
        subscriptionStatus: store.subscription_status,
        subscriptionPaystackCode: store.subscription_paystack_code,
        subscriptionNextPaymentDate: store.subscription_next_payment_date,
        pendingReference
      }
    });
  } catch (error) {
    console.error('Subscription GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
