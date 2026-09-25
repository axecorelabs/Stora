import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redis, claimCodeKey, claimVerifyLimiter } from '@/lib/redis';
import { recordLegalAcceptance } from '@/lib/legalAcceptance';
import { transformStore } from '@/lib/transformStore';

// POST - Verify the emailed code and, on match, atomically hand the store
// over to the claimant. body: { code }
export async function POST(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { success: withinLimit } = await claimVerifyLimiter.limit(user.id);
    if (!withinLimit) {
      return NextResponse.json({ success: false, message: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const { storeId } = await params;
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!code) {
      return NextResponse.json({ success: false, message: 'Verification code is required' }, { status: 400 });
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

    const storedCode = await redis.get(claimCodeKey(storeId));
    if (!storedCode) {
      return NextResponse.json({ success: false, message: 'Code expired or not found. Request a new one.' }, { status: 400 });
    }

    if (String(storedCode) !== code) {
      return NextResponse.json({ success: false, message: 'Incorrect code' }, { status: 400 });
    }

    // Atomic conditional claim -- zero rows back means someone else won the
    // race (or the store was claimed/removed between the checks above and
    // now), not a crash. See Part G plan's Backend section for why this is
    // a conditional UPDATE rather than relying on a UNIQUE-constraint catch.
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

    await redis.del(claimCodeKey(storeId));

    await supabaseAdmin.from('business_claims').insert({
      store_id: storeId,
      user_id: user.id,
      status: 'approved',
      method: 'email_otp',
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
    console.error('Claim verify error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
