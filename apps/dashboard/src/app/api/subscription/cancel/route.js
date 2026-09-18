import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { applyListingInactiveState, resolveListingStoreByOwner } from '@/lib/listingSubscription';
import { applyFullStoreInactiveState, resolveFullStoreByOwner } from '@/lib/fullStoreSubscription';

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
    throw err;
  }
  return data.data;
}

// POST /api/subscription/cancel -- disables the Paystack subscription and
// marks the store as cancelled.
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const { data: ownerStore } = await supabaseAdmin
      .from('stores')
      .select('id, platform_mode')
      .eq('owner_id', user.id)
      .single();

    if (!ownerStore) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    if (ownerStore.platform_mode === 'listing') {
      const store = await resolveListingStoreByOwner(user.id);

      if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
      if (store.subscription_status !== 'active') {
        return NextResponse.json({ success: false, message: 'No active subscription to cancel' }, { status: 400 });
      }

      if (store.subscription_paystack_code) {
        await paystackRequest('/subscription/disable', {
          method: 'POST',
          body: {
            code: store.subscription_paystack_code,
            token: process.env.PAYSTACK_SECRET_KEY
          }
        });
      }

      await applyListingInactiveState({
        storeId: store.id,
        ownerId: user.id,
        status: 'cancelled',
        subscriptionCode: store.subscription_paystack_code || null,
        cancelledAt: new Date().toISOString(),
        raw: {
          source: 'dashboard_cancel',
          subscription_code: store.subscription_paystack_code || null
        }
      });

      return NextResponse.json({ success: true });
    }

    const store = await resolveFullStoreByOwner(user.id);

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    if (store.full_store_subscription_status !== 'active') {
      return NextResponse.json({ success: false, message: 'No active full-store subscription to cancel' }, { status: 400 });
    }

    if (store.full_store_subscription_paystack_code) {
      await paystackRequest('/subscription/disable', {
        method: 'POST',
        body: {
          code: store.full_store_subscription_paystack_code,
          token: process.env.PAYSTACK_SECRET_KEY
        }
      });
    }

    await applyFullStoreInactiveState({
      storeId: store.id,
      ownerId: user.id,
      status: 'cancelled',
      subscriptionCode: store.full_store_subscription_paystack_code || null,
      cancelledAt: new Date().toISOString(),
      raw: {
        source: 'dashboard_cancel',
        subscription_code: store.full_store_subscription_paystack_code || null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription cancel error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to cancel subscription' }, { status: 500 });
  }
}
