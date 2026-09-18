import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

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
    throw new Error(data.message || `Paystack error: ${res.status}`);
  }
  return data.data;
}

// POST /api/subscription/upgrade
// Cancels the listing subscription and switches platform_mode to 'store'.
// Gallery and branding remain untouched.
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, platform_mode, subscription_paystack_code, subscription_status')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    if (store.platform_mode !== 'listing') {
      return NextResponse.json({ success: false, message: 'Already on full store plan' }, { status: 400 });
    }

    // Cancel active Paystack subscription if one exists.
    if (store.subscription_paystack_code && store.subscription_status === 'active') {
      try {
        await paystackRequest('/subscription/disable', {
          method: 'POST',
          body: { code: store.subscription_paystack_code, token: process.env.PAYSTACK_SECRET_KEY }
        });
      } catch (err) {
        // Log but don't block the upgrade -- the webhook will reconcile.
        console.error('Paystack subscription disable failed during upgrade:', err);
      }
    }

    await supabaseAdmin
      .from('stores')
      .update({
        platform_mode: 'store',
        subscription_status: 'none',
        subscription_paystack_code: null,
        subscription_next_payment_date: null,
        full_store_subscription_status: 'none',
        full_store_subscription_paystack_code: null,
        full_store_subscription_next_payment_date: null,
        full_store_subscription_grace_ends_at: null,
        full_store_subscription_locked_at: null
      })
      .eq('id', store.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription upgrade error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Upgrade failed' }, { status: 500 });
  }
}
