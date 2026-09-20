import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { setListingWebsiteEnabled } from '@/lib/listingSubscription';

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

// POST /api/subscription/downgrade
// Switches a full-store account to listing mode. Listing remains inactive
// until the owner subscribes to the monthly listing plan.
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, platform_mode, subscription_status, subscription_paystack_code, full_store_subscription_status, full_store_subscription_paystack_code, full_store_subscription_next_payment_date')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    if (store.platform_mode === 'listing') {
      return NextResponse.json({ success: false, message: 'Already on business listing mode' }, { status: 400 });
    }

    // Cancel any active Paystack subscription before wiping our own record
    // of its code below -- otherwise Paystack keeps auto-charging the
    // vendor's card every cycle with no way left to stop it, since the
    // code that identifies the subscription to Paystack is gone from our
    // side right after this. Checks both fields defensively (mirrors the
    // two columns this route already resets below); full_store_* is the
    // one actually being downgraded away from in practice.
    if (store.full_store_subscription_paystack_code && store.full_store_subscription_status === 'active') {
      try {
        await paystackRequest('/subscription/disable', {
          method: 'POST',
          body: { code: store.full_store_subscription_paystack_code, token: process.env.PAYSTACK_SECRET_KEY }
        });
      } catch (err) {
        // Log but don't block the downgrade -- matches upgrade/route.js's
        // own handling of this exact situation in the opposite direction.
        console.error('Paystack subscription disable failed during downgrade:', err);
      }
    }
    if (store.subscription_paystack_code && store.subscription_status === 'active') {
      try {
        await paystackRequest('/subscription/disable', {
          method: 'POST',
          body: { code: store.subscription_paystack_code, token: process.env.PAYSTACK_SECRET_KEY }
        });
      } catch (err) {
        console.error('Paystack subscription disable failed during downgrade:', err);
      }
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('stores')
      .update({
        platform_mode: 'listing',
        subscription_status: 'none',
        subscription_paystack_code: null,
        subscription_next_payment_date: null,
        full_store_subscription_status: 'none',
        full_store_subscription_paystack_code: null,
        full_store_subscription_next_payment_date: null,
        full_store_subscription_grace_ends_at: null,
        full_store_subscription_locked_at: null,
        updated_at: now
      })
      .eq('id', store.id);

    if (updateError) {
      console.error('Subscription downgrade store update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Could not switch mode right now. Please try again.' },
        { status: 500 }
      );
    }

    // Listing pages should stay hidden until subscription activation.
    try {
      await setListingWebsiteEnabled(store.id, false);
    } catch (websiteError) {
      console.error('Subscription downgrade website visibility error:', websiteError);
      // Best-effort rollback so we don't leave the account in listing mode
      // while listing visibility update failed.
      const { error: rollbackError } = await supabaseAdmin
        .from('stores')
        .update({
          platform_mode: 'store',
          subscription_status: store.subscription_status || 'none',
          subscription_paystack_code: store.subscription_paystack_code || null,
          full_store_subscription_status: store.full_store_subscription_status || 'none',
          full_store_subscription_paystack_code: store.full_store_subscription_paystack_code || null,
          full_store_subscription_next_payment_date: store.full_store_subscription_next_payment_date || null,
          full_store_subscription_grace_ends_at: null,
          full_store_subscription_locked_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', store.id);

      if (rollbackError) {
        console.error('Subscription downgrade rollback error:', rollbackError);
      }

      return NextResponse.json(
        { success: false, message: 'Could not complete switch safely. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription downgrade error:', error);
    return NextResponse.json(
      { success: false, message: 'Downgrade failed. Please try again.' },
      { status: 500 }
    );
  }
}
