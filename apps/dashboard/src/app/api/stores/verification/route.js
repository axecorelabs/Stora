import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { verificationLimiter } from '@/lib/redis';
import { verifyNIN, verifyNINFaceMatch } from '@/lib/qoreid';
import { recordLegalAcceptance } from '@/lib/legalAcceptance';

const NIN_REGEX = /^\d{11}$/;

// Case/whitespace-insensitive only -- deliberately not fuzzy. A vendor's
// account name and their NIN bio-data should read as the same name; this
// is a consistency check on top of the biometric face-match below, not
// the primary security gate itself.
function namesMatch(a, b) {
  const normalize = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return normalize(a) === normalize(b) && normalize(a).length > 0;
}

function summarize(row) {
  if (!row) return { status: 'unverified' };
  return {
    status: row.status,
    ninLast4: row.nin_last4,
    verifiedAt: row.verified_at,
    failureReason: row.status === 'failed' || row.status === 'error' ? row.failure_reason : undefined
  };
}

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, is_verified, verification_status')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .single();

    if (!store) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    const { data: lastAttempt } = await supabaseAdmin
      .from('vendor_verifications')
      .select('status, nin_last4, verified_at, failure_reason')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        isVerified: store.is_verified,
        verificationStatus: store.verification_status,
        lastAttempt: summarize(lastAttempt)
      }
    });
  } catch (error) {
    console.error('Verification status fetch error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req) {
  let verificationRowId = null;

  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { idNumber, photoBase64, consentGiven } = await req.json();

    // No QoreID call -- and no wallet spend -- happens without explicit
    // consent. NDPR requires this for NIN processing specifically.
    if (consentGiven !== true) {
      return NextResponse.json(
        { success: false, message: 'Consent is required to verify your identity' },
        { status: 400 }
      );
    }

    // Consent to share the NIN/selfie with QoreID is a separate fact from
    // whether the verification itself later succeeds -- this happens as
    // soon as the checkbox clears validation, alongside the existing
    // vendor_verifications.consent_given_at column (that one's scoped to
    // this specific attempt row; this is the same event in the
    // cross-document audit trail every other acceptance goes through).
    await recordLegalAcceptance({
      actorType: 'vendor_user',
      actorId: user.id,
      documents: ['vendor_kyc_policy'],
      context: 'kyc_verification',
      request: req
    });

    if (!idNumber || !NIN_REGEX.test(idNumber)) {
      return NextResponse.json({ success: false, message: 'Enter a valid 11-digit NIN' }, { status: 400 });
    }
    if (!photoBase64) {
      return NextResponse.json({ success: false, message: 'A selfie photo is required' }, { status: 400 });
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .single();

    if (!store) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    const { success: withinLimit } = await verificationLimiter.limit(store.id);
    if (!withinLimit) {
      return NextResponse.json(
        { success: false, message: 'Too many verification attempts. Try again tomorrow.' },
        { status: 429 }
      );
    }

    // Prevents a double-submit (or a retry while the first call is still
    // in flight) from spamming a second billable QoreID call.
    const { data: pendingAttempt } = await supabaseAdmin
      .from('vendor_verifications')
      .select('id')
      .eq('store_id', store.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingAttempt) {
      return NextResponse.json(
        { success: false, message: 'A verification attempt is already in progress' },
        { status: 409 }
      );
    }

    const ninLast4 = idNumber.slice(-4);
    const { data: attemptRow, error: insertError } = await supabaseAdmin
      .from('vendor_verifications')
      .insert({
        store_id: store.id,
        status: 'pending',
        nin_last4: ninLast4,
        consent_given_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError || !attemptRow) {
      console.error('Verification attempt insert error:', insertError);
      return NextResponse.json({ success: false, message: 'Could not start verification' }, { status: 500 });
    }
    verificationRowId = attemptRow.id;

    let identityResult;
    try {
      identityResult = await verifyNIN({ idNumber, firstname: user.firstName, lastname: user.lastName });
    } catch (error) {
      // error.message is a generic "QoreID request failed: <status>" (see
      // qoreid.js) -- safe to store and log as-is, never the raw payload.
      await markFailed(verificationRowId, 'error', 'Identity lookup failed');
      console.error('QoreID NIN lookup error for verification', verificationRowId, error.message);
      return NextResponse.json({ success: false, message: 'Could not verify this NIN right now. Try again later.' }, { status: 502 });
    }

    const nameMatch = namesMatch(user.firstName, identityResult?.nin?.firstname)
      && namesMatch(user.lastName, identityResult?.nin?.lastname);

    let faceResult;
    try {
      faceResult = await verifyNINFaceMatch({ idNumber, photoBase64 });
    } catch (error) {
      await markFailed(verificationRowId, 'error', 'Face verification failed', { name_match: nameMatch });
      console.error('QoreID face-match error for verification', verificationRowId, error.message);
      return NextResponse.json({ success: false, message: 'Could not verify your photo right now. Try again later.' }, { status: 502 });
    }

    const faceCheck = faceResult?.summary?.face_verification_check;
    const faceMatched = !!faceCheck?.match;

    // Face-match is the actual biometric proof the submitter is the NIN's
    // rightful holder -- the load-bearing security check. name_match is a
    // consistency check on top: without it, a vendor could complete a
    // real, genuine face-match against a NIN that isn't the one their
    // Stora account is registered under. Both must pass.
    const verified = faceMatched && nameMatch;

    const updatePayload = {
      status: verified ? 'verified' : 'failed',
      provider_reference: String(identityResult?.id ?? faceResult?.id ?? ''),
      name_match: nameMatch,
      face_match_score: faceCheck?.match_score ?? null,
      matching_threshold: faceCheck?.matching_threshold ?? null,
      updated_at: new Date().toISOString(),
      ...(verified
        ? { verified_at: new Date().toISOString() }
        : { failure_reason: !faceMatched ? 'Selfie did not match your NIN photo' : 'Name on the NIN does not match your account name' })
    };

    await supabaseAdmin.from('vendor_verifications').update(updatePayload).eq('id', verificationRowId);

    if (verified) {
      await supabaseAdmin
        .from('stores')
        .update({ is_verified: true, verification_status: 'verified', updated_at: new Date().toISOString() })
        .eq('id', store.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        status: updatePayload.status,
        ninLast4,
        verifiedAt: updatePayload.verified_at || null,
        failureReason: updatePayload.failure_reason
      }
    });
  } catch (error) {
    if (verificationRowId) {
      await markFailed(verificationRowId, 'error', 'Unexpected error');
    }
    console.error('Verification submission error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

async function markFailed(rowId, status, failureReason, extra = {}) {
  await supabaseAdmin
    .from('vendor_verifications')
    .update({ status, failure_reason: failureReason, updated_at: new Date().toISOString(), ...extra })
    .eq('id', rowId);
}
