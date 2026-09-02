import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Admin-side contract status change -- 'declined' withdraws a still-
// pending proposal (the vendor hasn't responded yet, admin changed their
// mind); 'terminated' ends a currently-accepted partnership. Both are
// admin actions distinct from the vendor's own accept/decline
// (apps/dashboard's PATCH /api/partnership/[contractId]/respond).
// Terminating also flips stores.is_partner off in the same request --
// the two must never go out of sync, since checkout math
// (computePaymentSplit) trusts is_partner as the live gate.
export async function PATCH(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { storeId, contractId } = await params;
  const { status } = await request.json();

  if (!['declined', 'terminated'].includes(status)) {
    return NextResponse.json({ success: false, message: 'status must be declined or terminated' }, { status: 400 });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from('partner_contracts')
    .select('id, store_id, status')
    .eq('id', contractId)
    .eq('store_id', storeId)
    .single();
  if (fetchError || !contract) {
    return NextResponse.json({ success: false, message: 'Contract not found' }, { status: 404 });
  }
  if (status === 'declined' && contract.status !== 'proposed') {
    return NextResponse.json({ success: false, message: 'Only a pending proposal can be withdrawn' }, { status: 400 });
  }
  if (status === 'terminated' && contract.status !== 'accepted') {
    return NextResponse.json({ success: false, message: 'Only an accepted contract can be terminated' }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('partner_contracts')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', contractId);
  if (updateError) {
    console.error('Error updating partner contract:', updateError);
    return NextResponse.json({ success: false, message: 'Failed to update contract' }, { status: 500 });
  }

  if (status === 'terminated') {
    const { error: storeUpdateError } = await supabaseAdmin
      .from('stores')
      .update({ is_partner: false })
      .eq('id', storeId);
    if (storeUpdateError) {
      console.error('Error un-setting is_partner after contract termination:', storeUpdateError);
      return NextResponse.json({ success: false, message: 'Contract terminated but failed to update store status' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, status });
}
