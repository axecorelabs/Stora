import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import {
  applyListingActiveState,
  getLatestPendingTransactionReference,
  resolveListingStoreByOwner,
  upsertSubscriptionTransaction
} from '@/lib/listingSubscription';
import {
  applyFullStoreActiveState,
  getLatestPendingFullStoreTransactionReference,
  resolveFullStoreByOwner,
  upsertFullStoreSubscriptionTransaction
} from '@/lib/fullStoreSubscription';
import { resolveListingCycleFromPlanCode, addBillingCycle } from '@/lib/listingSubscriptionPlans';

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

// POST /api/subscription/confirm
// Verifies Paystack transaction reference and activates the listing store.
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const inputReference = typeof body?.reference === 'string' ? body.reference : null;

    const { data: ownerStore } = await supabaseAdmin
      .from('stores')
      .select('id, platform_mode, subscription_status, full_store_subscription_status')
      .eq('owner_id', user.id)
      .single();

    if (!ownerStore) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    const isListing = ownerStore.platform_mode === 'listing';
    const store = isListing
      ? await resolveListingStoreByOwner(user.id)
      : await resolveFullStoreByOwner(user.id);

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    if (isListing && store.subscription_status === 'active') {
      return NextResponse.json({ success: true, data: { alreadyActive: true } });
    }

    if (!isListing && store.full_store_subscription_status === 'active') {
      return NextResponse.json({ success: true, data: { alreadyActive: true } });
    }

    const reference = inputReference || (isListing
      ? await getLatestPendingTransactionReference(store.id)
      : await getLatestPendingFullStoreTransactionReference(store.id));
    if (!reference) {
      return NextResponse.json({ success: false, message: 'No pending payment reference found for this store' }, { status: 404 });
    }

    const tx = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const paid = tx?.status === 'success';
    const planCode = tx?.plan_object?.plan_code || tx?.plan?.plan_code || null;
    // Listing now has 3 valid plan codes (one per cycle) instead of 1 --
    // this resolves both "is it a listing plan" and which cycle at once.
    const listingCycle = resolveListingCycleFromPlanCode(planCode);
    const expectedPlanCode = isListing
      ? null // checked via listingCycle below instead of a single flat code
      : process.env.PAYSTACK_FULL_STORE_PLAN_CODE;
    const purpose = tx?.metadata?.purpose;
    const metadataStoreId = tx?.metadata?.store_id;

    if (!paid) {
      const pendingPayload = {
        storeId: store.id,
        ownerId: user.id,
        reference,
        status: 'pending',
        amountKobo: tx?.amount ?? null,
        currency: tx?.currency ?? null,
        providerTransactionId: tx?.id ? String(tx.id) : null,
        providerSubscriptionCode: tx?.subscription?.subscription_code || tx?.subscription_code || null,
        providerCustomerCode: tx?.customer?.customer_code || null,
        providerPlanCode: planCode,
        paidAt: null,
        verificationPayload: tx
      };

      if (isListing) {
        await upsertSubscriptionTransaction(pendingPayload);
      } else {
        await upsertFullStoreSubscriptionTransaction(pendingPayload);
      }

      return NextResponse.json({ success: false, message: 'Payment is not successful yet' }, { status: 409 });
    }

    const expectedPurpose = isListing ? 'listing_subscription' : 'full_store_subscription';
    const planMatches = isListing
      ? (listingCycle ? true : purpose === expectedPurpose)
      : (expectedPlanCode ? planCode === expectedPlanCode : purpose === expectedPurpose);
    if (!planMatches) {
      return NextResponse.json({ success: false, message: 'Payment does not match store subscription plan' }, { status: 409 });
    }

    if (metadataStoreId && metadataStoreId !== store.id) {
      return NextResponse.json({ success: false, message: 'Payment reference does not belong to this store' }, { status: 403 });
    }

    const resolvedListingCycle = listingCycle || tx?.metadata?.billing_cycle || 'monthly';
    const nextPaymentDate = tx?.paid_at
      ? (isListing ? addBillingCycle(new Date(tx.paid_at), resolvedListingCycle) : new Date(new Date(tx.paid_at).getTime() + 30 * 24 * 60 * 60 * 1000)).toISOString()
      : null;

    const activePayload = {
      storeId: store.id,
      ownerId: user.id,
      subscriptionCode: tx?.subscription?.subscription_code || tx?.subscription_code || null,
      nextPaymentDate,
      customerCode: tx?.customer?.customer_code || null,
      planCode,
      paidAt: tx?.paid_at || null,
      raw: tx
    };

    if (isListing) {
      await applyListingActiveState({ ...activePayload, billingCycle: resolvedListingCycle });
    } else {
      await applyFullStoreActiveState(activePayload);
    }

    await captureServerEvent(user.id, 'subscription_confirmed', {
      subscriptionMode: isListing ? 'listing' : 'full_store',
      storeId: store.id,
      reference,
      providerPlanCode: planCode || null,
      nextPaymentDate: nextPaymentDate || null
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription confirm error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to confirm subscription' }, { status: 500 });
  }
}
