import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Toggles a listing's is_active -- a reversible "hide this listing"
// action. Deliberately not touching is_deleted, which is the vendor's own
// destructive-delete flow in apps/dashboard.
export async function PATCH(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { productId } = await params;
  const { isActive } = await request.json();

  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ success: false, message: 'isActive must be a boolean' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('inventory')
    .update({ is_active: isActive })
    .eq('id', productId)
    .select('id, name, is_active')
    .single();

  if (error || !data) {
    console.error('Error updating product status:', error);
    return NextResponse.json({ success: false, message: 'Failed to update product' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    product: { id: data.id, name: data.name, isActive: !!data.is_active }
  });
}
