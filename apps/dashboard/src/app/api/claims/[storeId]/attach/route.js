import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { claimSendCodeLimiter } from '@/lib/redis';
import { recordLegalAcceptance } from '@/lib/legalAcceptance';
import { transformStore } from '@/lib/transformStore';

// POST - Unverified self-attach claim path, for a listing with no
// store_email (and so nothing to verify against -- see GET .../route.js's
// verificationMethod branch). Same shape as verify/route.js's atomic
// claim, minus the code check. Approved immediately: review here is
// reactive-only, via the report-listing dispute flow, not a pre-claim
// gate (see the Part H plan).
export async function POST(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    // Reuses the send-code limiter's per-user "claim attempt" budget --
    // there's no OTP code to brute-force here, but a light bound still
    // keeps a script from racing through many storeIds looking for
    // unclaimed, contact-info-less listings to land a first-claim on.
    const { success: withinLimit } = await claimSendCodeLimiter.limit(user.id);
    if (!withinLimit) {
      return NextResponse.json({ success: false, message: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { storeId } = await params;

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .select('id, store_email, claim_status, owner_id')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      return NextResponse.json({ success: false, message: 'Business not found' }, { status: 404 });
    }

    if (store.owner_id || store.claim_status !== 'unclaimed') {
      return NextResponse.json({ success: false, message: 'This business has already been claimed' }, { status: 409 });
    }

    // Server-side enforcement, not just UI branching -- a store WITH an
    // email must go through the verified email-OTP path regardless of
    // what the client sends.
    if (store.store_email) {
      return NextResponse.json(
        { success: false, message: 'This business has contact info on file -- please verify by email instead' },
        { status: 422 }
      );
    }

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

    const { data: claimedStore, error: claimError } = await supabaseAdmin
      .from('stores')
      .update({ owner_id: user.id, claim_status: 'claimed', claimed_at: new Date().toISOString() })
      .eq('id', storeId)
      .is('owner_id', null)
      .eq('claim_status', 'unclaimed')
      .select()
      .single();

    if (claimError || !claimedStore) {
      return NextResponse.json({ success: false, message: 'This business has already been claimed' }, { status: 409 });
    }

    await supabaseAdmin.from('business_claims').insert({
      store_id: storeId,
      user_id: user.id,
      status: 'approved',
      method: 'unverified',
      reviewed_by: null,
      reviewed_at: new Date().toISOString()
    });

    await recordLegalAcceptance({
      actorType: 'user',
      actorId: user.id,
      documents: ['business_claim_attestation'],
      context: 'business_claim',
      request: req
    });

    await supabaseAdmin
      .from('users')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('onboarding_completed_at', null);

    return NextResponse.json({ success: true, message: 'Business claimed successfully', data: transformStore(claimedStore) });
  } catch (error) {
    console.error('Claim attach error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
