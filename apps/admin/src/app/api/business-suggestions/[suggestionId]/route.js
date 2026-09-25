import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Marks a suggestion actioned (staff created a real listing from it, see
// POST /api/stores) or dismissed (not worth pursuing) -- mirrors
// /api/stores/[storeId]/route.js's PATCH shape.
export async function PATCH(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { suggestionId } = await params;
  const { status } = await request.json();

  if (!['actioned', 'dismissed'].includes(status)) {
    return NextResponse.json({ success: false, message: 'status must be "actioned" or "dismissed"' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('business_suggestions')
    .update({ status, reviewed_by: staff.id, reviewed_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .select('id, status')
    .single();

  if (error || !data) {
    console.error('Error updating business suggestion:', error);
    return NextResponse.json({ success: false, message: 'Failed to update suggestion' }, { status: 500 });
  }

  return NextResponse.json({ success: true, suggestion: { id: data.id, status: data.status } });
}
