import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// The vendor's own accept/decline on a proposed partner_contracts row --
// distinct from the admin-side withdraw/terminate
// (apps/admin/.../contracts/[contractId]/route.js). Accept flips
// stores.is_partner on (the one thing checkout math actually trusts) and
// stamps partner_designated_at; decline only marks the contract itself,
// leaving is_partner untouched -- there was never a partnership to end.
export async function PATCH(request, { params }) {
  const user = await verifySession(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const { contractId } = await params;
  const { decision } = await request.json();
  if (!['accept', 'decline'].includes(decision)) {
    return NextResponse.json({ success: false, message: 'decision must be accept or decline' }, { status: 400 });
  }

  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!store) {
    return NextResponse.json({ success: false, message: 'No store found for this account' }, { status: 404 });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from('partner_contracts')
    .select('id, store_id, status')
    .eq('id', contractId)
    .eq('store_id', store.id)
    .single();
  if (fetchError || !contract) {
    return NextResponse.json({ success: false, message: 'Proposal not found' }, { status: 404 });
  }
  if (contract.status !== 'proposed') {
    return NextResponse.json({ success: false, message: 'This proposal has already been responded to' }, { status: 400 });
  }

  const newStatus = decision === 'accept' ? 'accepted' : 'declined';
  const { error: updateError } = await supabaseAdmin
    .from('partner_contracts')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('id', contractId);
  if (updateError) {
    console.error('Error responding to partnership proposal:', updateError);
    return NextResponse.json({ success: false, message: 'Failed to respond to proposal' }, { status: 500 });
  }

  if (decision === 'accept') {
    const { error: storeUpdateError } = await supabaseAdmin
      .from('stores')
      .update({ is_partner: true, partner_designated_at: new Date().toISOString() })
      .eq('id', store.id);
    if (storeUpdateError) {
      console.error('Error setting is_partner after accepting contract:', storeUpdateError);
      return NextResponse.json({ success: false, message: 'Accepted but failed to activate partnership' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}
