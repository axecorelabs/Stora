import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPartnershipProposalEmail } from '@/lib/email';

// Proposes a partnership contract -- replaces the old direct is_partner
// toggle entirely. Creates a 'proposed' row (blocked by
// partner_contracts_one_pending_uq while one's already pending for this
// store) and emails the vendor; they see it as a modal in apps/dashboard
// and only become a partner by accepting (PATCH .../respond there).
export async function POST(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { storeId } = await params;
  const { rateType, rateValue, terms } = await request.json();

  if (!['percentage', 'flat'].includes(rateType)) {
    return NextResponse.json({ success: false, message: 'rateType must be percentage or flat' }, { status: 400 });
  }
  const numericRate = parseFloat(rateValue);
  if (!Number.isFinite(numericRate) || numericRate < 0) {
    return NextResponse.json({ success: false, message: 'rateValue must be a non-negative number' }, { status: 400 });
  }
  if (rateType === 'percentage' && numericRate > 1) {
    return NextResponse.json({ success: false, message: 'A percentage rate must be between 0 and 1 (e.g. 0.08 for 8%)' }, { status: 400 });
  }

  const { data: store, error: storeError } = await supabaseAdmin
    .from('stores')
    .select('id, store_name, owner_id')
    .eq('id', storeId)
    .single();
  if (storeError || !store) {
    return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
  }

  const { data: contract, error: insertError } = await supabaseAdmin
    .from('partner_contracts')
    .insert({
      store_id: storeId,
      status: 'proposed',
      rate_type: rateType,
      rate_value: numericRate,
      terms: terms || null,
      proposed_by: staff.id
    })
    .select('id, status, rate_type, rate_value, terms, proposed_at')
    .single();

  if (insertError) {
    // Unique-violation on the partial index -- a proposal is already pending.
    if (insertError.code === '23505') {
      return NextResponse.json({ success: false, message: 'A proposal is already pending for this vendor' }, { status: 409 });
    }
    console.error('Error creating partner contract:', insertError);
    return NextResponse.json({ success: false, message: 'Failed to create proposal' }, { status: 500 });
  }

  let emailResult = { success: false, error: 'Vendor has no account email on file' };
  const { data: owner } = await supabaseAdmin
    .from('users')
    .select('email, first_name')
    .eq('id', store.owner_id)
    .maybeSingle();
  if (owner?.email) {
    emailResult = await sendPartnershipProposalEmail(owner.email, owner.first_name, {
      storeName: store.store_name,
      rateType,
      rateValue: numericRate,
      terms
    });
  }
  if (!emailResult.success) {
    console.error('Partnership proposal email failed (contract still created):', emailResult.error);
  }

  // Same notifications table apps/dashboard's own bell/NotificationPanel
  // already reads (realtime-subscribed there, so this shows up live --
  // no changes needed on that side, a plain insert into the shared table
  // is enough). Non-fatal: the email above and the in-dashboard modal are
  // the two things that actually have to work; this is a convenience.
  const { error: notificationError } = await supabaseAdmin.from('notifications').insert({
    user_id: store.owner_id,
    title: 'Stora sent you a partnership proposal',
    message: `Review the proposed terms for ${store.store_name} in your dashboard.`,
    type: 'announcement',
    related_entity_type: 'partner_contract',
    related_entity_id: contract.id
  });
  if (notificationError) {
    console.error('Error creating partnership notification (non-fatal):', notificationError);
  }

  return NextResponse.json({
    success: true,
    contract: {
      id: contract.id,
      status: contract.status,
      rateType: contract.rate_type,
      rateValue: parseFloat(contract.rate_value),
      terms: contract.terms,
      proposedAt: contract.proposed_at
    },
    emailSent: emailResult.success
  });
}
