import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { setListingWebsiteEnabled } from '@/lib/listingSubscription';

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
      .select('id, platform_mode, subscription_status, subscription_paystack_code')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    if (store.platform_mode === 'listing') {
      return NextResponse.json({ success: false, message: 'Already on business listing mode' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('stores')
      .update({
        platform_mode: 'listing',
        subscription_status: 'none',
        subscription_paystack_code: null,
        subscription_next_payment_date: null,
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
