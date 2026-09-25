import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Actions a dispute: 'reviewing' (staff picked it up), 'dismissed' (not a
// real issue), or 'upheld' -- the one case that also revokes the claim it
// was filed against, resetting the store back to unclaimed so the real
// owner (or anyone else) can claim it properly afterward.
export async function PATCH(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { disputeId } = await params;
  const { status } = await request.json();

  if (!['reviewing', 'upheld', 'dismissed'].includes(status)) {
    return NextResponse.json({ success: false, message: 'status must be "reviewing", "upheld", or "dismissed"' }, { status: 400 });
  }

  const { data: dispute, error: fetchError } = await supabaseAdmin
    .from('business_claim_disputes')
    .select('id, store_id')
    .eq('id', disputeId)
    .single();

  if (fetchError || !dispute) {
    return NextResponse.json({ success: false, message: 'Dispute not found' }, { status: 404 });
  }

  if (status === 'upheld') {
    const { error: revokeError } = await supabaseAdmin
      .from('stores')
      .update({ owner_id: null, claim_status: 'unclaimed', claimed_at: null })
      .eq('id', dispute.store_id);

    if (revokeError) {
      console.error('Error revoking claim:', revokeError);
      return NextResponse.json({ success: false, message: 'Failed to revoke claim' }, { status: 500 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('business_claim_disputes')
    .update({ status, reviewed_by: staff.id, reviewed_at: new Date().toISOString() })
    .eq('id', disputeId)
    .select('id, status')
    .single();

  if (error || !data) {
    console.error('Error updating business claim dispute:', error);
    return NextResponse.json({ success: false, message: 'Failed to update dispute' }, { status: 500 });
  }

  return NextResponse.json({ success: true, dispute: { id: data.id, status: data.status } });
}
