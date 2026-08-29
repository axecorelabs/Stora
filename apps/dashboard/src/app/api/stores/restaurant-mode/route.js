import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// PATCH - Restaurant Mode is a per-store, non-restrictive toggle: turning
// it on swaps in a menu-first "Add Menu Item" flow and a sectioned menu
// storefront layout, but never restricts what the store can sell (a
// restaurant that also sells branded mugs keeps using the generic add-item
// flow for those). No prerequisite gating needed, unlike fulfillment-method's
// paystack_ready check -- this toggle has no dependency on payout setup.
export async function PATCH(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { restaurantMode } = await req.json().catch(() => ({}));
    if (typeof restaurantMode !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'restaurantMode must be a boolean' },
        { status: 400 }
      );
    }

    const { data: updatedStore, error } = await supabaseAdmin
      .from('stores')
      .update({ restaurant_mode: restaurantMode, updated_at: new Date().toISOString() })
      .eq('owner_id', user.id)
      .select('restaurant_mode')
      .single();

    if (error || !updatedStore) {
      console.error('Error updating restaurant mode:', error);
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Restaurant Mode preference saved',
      data: { restaurantMode: updatedStore.restaurant_mode }
    });
  } catch (error) {
    console.error('Restaurant mode update error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
