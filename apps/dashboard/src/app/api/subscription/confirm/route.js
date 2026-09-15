import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import {
  applyListingActiveState,
  getLatestPendingTransactionReference,
  resolveListingStoreByOwner,
  upsertSubscriptionTransaction
} from '@/lib/listingSubscription';

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

    const store = await resolveListingStoreByOwner(user.id);

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    if (store.subscription_status === 'active') {
      return NextResponse.json({ success: true, data: { alreadyActive: true } });
    }

    const reference = inputReference || await getLatestPendingTransactionReference(store.id);
    if (!reference) {
      return NextResponse.json({ success: false, message: 'No pending payment reference found for this listing' }, { status: 404 });
    }

    const tx = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const paid = tx?.status === 'success';
    const planCode = tx?.plan_object?.plan_code || tx?.plan?.plan_code || null;
    const expectedPlanCode = process.env.PAYSTACK_LISTING_PLAN_CODE;
    const purpose = tx?.metadata?.purpose;
    const metadataStoreId = tx?.metadata?.store_id;

    if (!paid) {
      await upsertSubscriptionTransaction({
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
      });
      return NextResponse.json({ success: false, message: 'Payment is not successful yet' }, { status: 409 });
    }

    const planMatches = expectedPlanCode ? planCode === expectedPlanCode : purpose === 'listing_subscription';
    if (!planMatches) {
      return NextResponse.json({ success: false, message: 'Payment does not match listing subscription plan' }, { status: 409 });
    }

    if (metadataStoreId && metadataStoreId !== store.id) {
      return NextResponse.json({ success: false, message: 'Payment reference does not belong to this store' }, { status: 403 });
    }

    const nextPaymentDate = tx?.paid_at
      ? new Date(new Date(tx.paid_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await applyListingActiveState({
      storeId: store.id,
      ownerId: user.id,
      subscriptionCode: tx?.subscription?.subscription_code || tx?.subscription_code || null,
      nextPaymentDate,
      customerCode: tx?.customer?.customer_code || null,
      planCode,
      paidAt: tx?.paid_at || null,
      raw: tx
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription confirm error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to confirm subscription' }, { status: 500 });
  }
}
