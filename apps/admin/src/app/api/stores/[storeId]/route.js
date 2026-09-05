import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Two independent per-store toggles, either or both sent in one PATCH:
//
// - isActive: the "Account" suspend toggle -- a harder kill switch than the
//   Storefront toggle (/api/stores/[storeId]/storefront, which only flips
//   website.isEnabled). Disabling is_active excludes the store from public
//   search/storefront visibility too (both gates are checked together --
//   see search_vendors()/search_products()), but it's meant for suspending
//   the account itself, not routine publish/unpublish. Does not touch the
//   owner's login, which is /api/users/[userId]'s job.
//
// - businessVerified: the staff-granted public "Verified by Stora" badge
//   (business_verified_at) -- this is the ONLY place it's ever set. A
//   vendor contacts Stora directly and staff decide; there's no self-serve
//   request flow. Distinct from is_verified (the vendor's own QoreID NIN +
//   selfie identity check, set by the vendor themselves, never by admin) --
//   completing that check alone no longer earns this badge.
export async function PATCH(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { storeId } = await params;
  const { isActive, businessVerified } = await request.json();

  if (isActive === undefined && businessVerified === undefined) {
    return NextResponse.json({ success: false, message: 'Nothing to update' }, { status: 400 });
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return NextResponse.json({ success: false, message: 'isActive must be a boolean' }, { status: 400 });
  }
  if (businessVerified !== undefined && typeof businessVerified !== 'boolean') {
    return NextResponse.json({ success: false, message: 'businessVerified must be a boolean' }, { status: 400 });
  }

  const dbUpdate = {};
  if (isActive !== undefined) dbUpdate.is_active = isActive;
  if (businessVerified !== undefined) dbUpdate.business_verified_at = businessVerified ? new Date().toISOString() : null;

  const { data, error } = await supabaseAdmin
    .from('stores')
    .update(dbUpdate)
    .eq('id', storeId)
    .select('id, store_name, is_active, business_verified_at')
    .single();

  if (error || !data) {
    console.error('Error updating store status:', error);
    return NextResponse.json({ success: false, message: 'Failed to update store' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    store: {
      id: data.id,
      storeName: data.store_name,
      isActive: !!data.is_active,
      businessVerified: !!data.business_verified_at
    }
  });
}
