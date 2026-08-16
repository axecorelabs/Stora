import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// PATCH - Vendor's choice of who absorbs the platform commission on their
// own sales: 'vendor' (default, deducted from their payout, customer pays
// the listed price) or 'customer' (added on top at checkout, vendor keeps
// the full listed price). Only affects orders placed AFTER this change --
// order_payment_splits snapshots the mode at checkout time
// (apps/store/src/app/api/orders/create/route.js's computePaymentSplit),
// so this never retroactively touches already-placed orders.
export async function PATCH(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { commissionBearer } = await req.json().catch(() => ({}));
    if (!['vendor', 'customer'].includes(commissionBearer)) {
      return NextResponse.json({ success: false, message: "commissionBearer must be 'vendor' or 'customer'" }, { status: 400 });
    }

    const { data: updatedStore, error } = await supabaseAdmin
      .from('stores')
      .update({ commission_bearer: commissionBearer, updated_at: new Date().toISOString() })
      .eq('owner_id', user.id)
      .select('commission_bearer')
      .single();

    if (error || !updatedStore) {
      console.error('Error updating commission bearer:', error);
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Commission preference saved',
      data: { commissionBearer: updatedStore.commission_bearer }
    });
  } catch (error) {
    console.error('Commission bearer update error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
