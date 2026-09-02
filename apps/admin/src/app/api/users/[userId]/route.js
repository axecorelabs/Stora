import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Toggles a vendor account's is_active -- this is what actually blocks
// sign-in to apps/dashboard (its own sign-in route checks is_active).
// Distinct from the store's own is_active (see /api/stores/[storeId]):
// a vendor can be locked out of their login while their storefront stays
// up, or vice versa.
export async function PATCH(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { userId } = await params;
  const { isActive } = await request.json();

  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ success: false, message: 'isActive must be a boolean' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select('id, email, is_active')
    .single();

  if (error || !data) {
    console.error('Error updating user status:', error);
    return NextResponse.json({ success: false, message: 'Failed to update account' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    user: { id: data.id, email: data.email, isActive: !!data.is_active }
  });
}
