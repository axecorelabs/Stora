import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCommerceApiAccess } from '@/lib/storeAccess';

// PATCH -- vendor's explicit opt-in to the morning delivery-digest Telegram
// message (api/cron/delivery-digest). Deliberately separate from connecting
// Telegram itself: Telegram already carries new-order notifications, so
// connecting it shouldn't silently enroll someone in a second, unrelated
// daily message too.
export async function PATCH(req) {
  try {
    const access = await requireCommerceApiAccess(req);
    if (!access.ok) {
      return access.response;
    }
    const { user } = access;

    const { enabled } = await req.json().catch(() => ({}));
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'enabled must be true or false' },
        { status: 400 }
      );
    }

    // Enabling without a connected Telegram chat would just be a setting
    // that silently does nothing -- reject at the API layer rather than
    // only disabling the toggle client-side.
    if (enabled) {
      const { data: existing } = await supabaseAdmin
        .from('stores')
        .select('telegram_chat_id')
        .eq('owner_id', user.id)
        .single();
      if (!existing?.telegram_chat_id) {
        return NextResponse.json(
          { success: false, message: 'Connect Telegram in Settings before turning this on' },
          { status: 400 }
        );
      }
    }

    const { data: updatedStore, error } = await supabaseAdmin
      .from('stores')
      .update({ delivery_digest_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('owner_id', user.id)
      .select('delivery_digest_enabled')
      .single();

    if (error || !updatedStore) {
      console.error('Error updating delivery digest preference:', error);
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: enabled ? "You'll get a Telegram message each morning with that day's deliveries" : 'Morning delivery digest turned off',
      data: { deliveryDigestEnabled: updatedStore.delivery_digest_enabled }
    });
  } catch (error) {
    console.error('Delivery digest preference update error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
