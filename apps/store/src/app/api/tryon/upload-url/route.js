import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyCustomerSession } from '@/lib/supabaseAuth';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { isOverDailyLimit, TRYON_DAILY_LIMIT } from '@/lib/tryonRateLimit';
import { getClientIp, LEGAL_DOCUMENT_VERSIONS } from '@/lib/legalAcceptance';
import { createTryonUploadIntent } from '@/lib/tryonUploadIntent';
import { generatePresignedUploadUrl } from '@/lib/r2';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB, after client-side compression
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function normalizeImageType(contentType) {
  const raw = String(contentType || '').toLowerCase().trim();
  return raw === 'image/jpg' ? 'image/jpeg' : raw;
}

function extensionForType(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function generateTryonObjectKey(customerId, contentType) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).slice(2, 12);
  const extension = extensionForType(contentType);
  return `tryon/${customerId}/${timestamp}-${randomString}.${extension}`;
}

// Photo upload requires a logged-in customer (no guest access -- this is
// meaningfully more sensitive than anything else this app collects) plus
// explicit consent, verified server-side rather than trusted from the
// client, in the same request as the presign so no photo is ever
// uploaded without a consent row already on record for it.
export async function POST(req) {
  try {
    const customerId = await verifyCustomerSession(req);
    if (!customerId) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const contentType = normalizeImageType(body?.contentType);
    const contentLength = Number(body?.contentLength || 0);
    const consentGiven = body?.consentGiven === true;
    const turnstileToken = body?.turnstileToken;

    if (!consentGiven) {
      return NextResponse.json(
        { success: false, message: 'Consent is required to use AI Try-On' },
        { status: 400 }
      );
    }

    const turnstileOk = await verifyTurnstileToken(turnstileToken, getClientIp(req));
    if (!turnstileOk) {
      return NextResponse.json({ success: false, message: 'Verification failed. Please try again.' }, { status: 403 });
    }

    if (await isOverDailyLimit(customerId)) {
      return NextResponse.json(
        { success: false, message: `You've reached today's limit of ${TRYON_DAILY_LIMIT} try-ons. Please try again tomorrow.` },
        { status: 429 }
      );
    }

    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json(
        { success: false, message: 'Only JPEG, PNG, and WebP images are allowed' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      return NextResponse.json({ success: false, message: 'contentLength is required' }, { status: 400 });
    }

    if (contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Image size must be less than 5MB' },
        { status: 422 }
      );
    }

    const key = generateTryonObjectKey(customerId, contentType);
    const uploadUrl = await generatePresignedUploadUrl(key, contentType, 5 * 60);
    const uploadIntentToken = createTryonUploadIntent({
      sub: customerId,
      key,
      contentType,
      contentLength
    });

    // Recorded directly (not via the shared recordLegalAcceptance, which
    // is fire-and-forget and returns nothing) since this specific caller
    // needs the inserted row's id back to link tryon_uploads to the
    // consent that authorized it.
    const { data: acceptance, error: acceptanceError } = await supabaseAdmin
      .from('legal_acceptances')
      .insert({
        actor_type: 'customer',
        actor_id: customerId,
        document: 'ai_tryon_terms',
        document_version: LEGAL_DOCUMENT_VERSIONS.ai_tryon_terms,
        context: 'ai_tryon_upload',
        ip_address: getClientIp(req),
        user_agent: req.headers.get('user-agent')
      })
      .select('id')
      .single();

    if (acceptanceError) {
      console.error('Failed to record AI try-on consent:', acceptanceError);
      return NextResponse.json({ success: false, message: 'Failed to record consent' }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const { data: upload, error: insertError } = await supabaseAdmin
      .from('tryon_uploads')
      .insert({
        customer_id: customerId,
        r2_key: key,
        content_type: contentType,
        content_length: contentLength,
        status: 'pending',
        consent_legal_acceptance_id: acceptance.id,
        expires_at: expiresAt
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to create tryon_uploads row:', insertError);
      return NextResponse.json({ success: false, message: 'Failed to prepare upload' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        uploadId: upload.id,
        uploadUrl,
        uploadIntentToken,
        requiredHeaders: { 'Content-Type': contentType },
        maxBytes: MAX_UPLOAD_BYTES
      }
    });
  } catch (error) {
    console.error('Try-on upload-url error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to prepare upload' },
      { status: 500 }
    );
  }
}
