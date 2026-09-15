import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function normalizeWebsiteConfig(rawWebsite) {
  if (!rawWebsite) return {};
  if (typeof rawWebsite === 'string') {
    try {
      return JSON.parse(rawWebsite);
    } catch {
      return {};
    }
  }
  return rawWebsite;
}

async function setListingWebsiteEnabled(storeId, enabled) {
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('website')
    .eq('id', storeId)
    .eq('platform_mode', 'listing')
    .maybeSingle();

  if (!store) return;

  const nextWebsite = {
    ...normalizeWebsiteConfig(store.website),
    isEnabled: !!enabled
  };

  await supabaseAdmin
    .from('stores')
    .update({
      website: nextWebsite,
      updated_at: new Date().toISOString()
    })
    .eq('id', storeId)
    .eq('platform_mode', 'listing');
}

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

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, subscription_paystack_code, subscription_status')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    if (store.subscription_status !== 'active') {
      return NextResponse.json({ success: false, message: 'No active subscription to cancel' }, { status: 400 });
    }

    // Tell Paystack to stop charging -- the subscription.disable webhook will
    // also fire and update the status, but we update locally too so the
    // dashboard reflects it immediately without waiting for the webhook.
    if (store.subscription_paystack_code) {
      await paystackRequest('/subscription/disable', {
        method: 'POST',
        body: {
          code: store.subscription_paystack_code,
          token: process.env.PAYSTACK_SECRET_KEY // Paystack requires this for disable
        }
      });
    }

    await supabaseAdmin
      .from('stores')
      .update({ subscription_status: 'cancelled' })
      .eq('id', store.id);

    await setListingWebsiteEnabled(store.id, false);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription cancel error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to cancel subscription' }, { status: 500 });
  }
}
