import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// b***@gmail.com -- enough for the claimant to recognize which inbox
// they'd need, never enough to actually read/guess the real address.
function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 1) || '*';
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

// GET - Claim eligibility + display info for the onboarding wizard's
// claim step. Auth-required: only reachable once a real dashboard session
// exists (the claimant already signed up / verified their own account).
export async function GET(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { storeId } = await params;

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .select('id, store_name, business_category, state, store_email, store_phone, address, claim_status, owner_id')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      return NextResponse.json({ success: false, message: 'Business not found' }, { status: 404 });
    }

    if (store.owner_id || store.claim_status !== 'unclaimed') {
      return NextResponse.json({ success: false, message: 'This business has already been claimed' }, { status: 409 });
    }

    // A claimant can only ever own one store -- surfaced here (before they
    // even try to send a code/attach) rather than as a confusing DB error
    // at the final verify/attach step.
    const { data: ownStore } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (ownStore) {
      return NextResponse.json(
        { success: false, message: 'You already have a store on Stora. Contact support to manage multiple businesses.' },
        { status: 409 }
      );
    }

    // Two branches: a listing with a real store_email can be verified
    // against it (email OTP); one without has nothing to verify against at
    // all, so it goes through the unverified self-attach path instead (see
    // POST .../attach) -- nothing to mask there, so the raw fields are
    // returned for the claimant to review/correct after attaching.
    if (!store.store_email) {
      return NextResponse.json({
        success: true,
        data: {
          id: store.id,
          storeName: store.store_name,
          businessCategory: store.business_category,
          state: store.state,
          storePhone: store.store_phone,
          address: store.address,
          verificationMethod: 'unverified'
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: store.id,
        storeName: store.store_name,
        businessCategory: store.business_category,
        state: store.state,
        maskedEmail: maskEmail(store.store_email),
        verificationMethod: 'email_otp'
      }
    });
  } catch (error) {
    console.error('Claim eligibility check error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
