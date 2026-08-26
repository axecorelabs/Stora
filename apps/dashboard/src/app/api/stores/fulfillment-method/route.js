import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// PATCH - Vendor's choice of who collects the delivery fee: 'platform_collected'
// (charged through Paystack alongside the merchandise, default) or
// 'pay_on_delivery' (the rider collects it in cash/transfer on arrival --
// merchandise payment is unaffected either way, only the delivery-fee
// portion moves off-platform). Only affects orders placed AFTER this
// change -- order_payment_splits snapshots the effective method at
// checkout time (apps/store/src/app/api/orders/create/route.js's
// computePaymentSplit), so this never retroactively touches already-placed
// orders.
export async function PATCH(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { fulfillmentMethod } = await req.json().catch(() => ({}));
    if (!['platform_collected', 'pay_on_delivery'].includes(fulfillmentMethod)) {
      return NextResponse.json(
        { success: false, message: "fulfillmentMethod must be 'platform_collected' or 'pay_on_delivery'" },
        { status: 400 }
      );
    }

    // 'platform_collected' is meaningless without a live Paystack
    // subaccount -- reject at the API layer rather than only disabling the
    // card client-side (the checkout route already falls back to
    // pay_on_delivery for a non-ready store regardless of this setting, but
    // saving it anyway would be a confusing, silently-ignored value).
    if (fulfillmentMethod === 'platform_collected') {
      const { data: existing } = await supabaseAdmin
        .from('stores')
        .select('paystack_ready')
        .eq('owner_id', user.id)
        .single();
      if (!existing?.paystack_ready) {
        return NextResponse.json(
          { success: false, message: 'Set up payouts before collecting delivery fees through Stora' },
          { status: 400 }
        );
      }
    }

    const { data: updatedStore, error } = await supabaseAdmin
      .from('stores')
      .update({ fulfillment_method: fulfillmentMethod, updated_at: new Date().toISOString() })
      .eq('owner_id', user.id)
      .select('fulfillment_method')
      .single();

    if (error || !updatedStore) {
      console.error('Error updating fulfillment method:', error);
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Delivery fulfillment preference saved',
      data: { fulfillmentMethod: updatedStore.fulfillment_method }
    });
  } catch (error) {
    console.error('Fulfillment method update error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
