import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// The "Account" suspend toggle -- a harder kill switch than the
// Storefront toggle (/api/stores/[storeId]/storefront, which only flips
// website.isEnabled). Disabling is_active excludes the store from
// public search/storefront visibility too (both gates are checked
// together -- see search_vendors()/search_products()), but it's meant
// for suspending the account itself, not routine publish/unpublish.
// Does not touch the owner's login, which is /api/users/[userId]'s job.
export async function PATCH(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { storeId } = await params;
  const { isActive } = await request.json();

  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ success: false, message: 'isActive must be a boolean' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('stores')
    .update({ is_active: isActive })
    .eq('id', storeId)
    .select('id, store_name, is_active')
    .single();

  if (error || !data) {
    console.error('Error updating store status:', error);
    return NextResponse.json({ success: false, message: 'Failed to update store' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    store: { id: data.id, storeName: data.store_name, isActive: !!data.is_active }
  });
}
