import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redis, claimCodeKey, claimSendCodeLimiter } from '@/lib/redis';
import { sendBusinessClaimEmail } from '@/lib/email';

const CODE_TTL_SECONDS = 10 * 60;

// POST - Generate a 6-digit code, store it in Redis keyed by the STORE
// being claimed, and email it to the store's own listed address (not the
// claimant's account email -- see claimCodeKey's comment in redis.js).
export async function POST(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { success: withinLimit } = await claimSendCodeLimiter.limit(user.id);
    if (!withinLimit) {
      return NextResponse.json({ success: false, message: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { storeId } = await params;

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .select('id, store_name, store_email, claim_status, owner_id')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      return NextResponse.json({ success: false, message: 'Business not found' }, { status: 404 });
    }

    if (store.owner_id || store.claim_status !== 'unclaimed') {
      return NextResponse.json({ success: false, message: 'This business has already been claimed' }, { status: 409 });
    }

    if (!store.store_email) {
      return NextResponse.json(
        { success: false, message: 'Email verification is not available for this business yet' },
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

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await redis.set(claimCodeKey(storeId), code, { ex: CODE_TTL_SECONDS });

    const result = await sendBusinessClaimEmail(store.store_email, code, store.store_name);
    if (!result.success) {
      return NextResponse.json({ success: false, message: 'Failed to send verification email. Please try again.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('Claim send-code error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
