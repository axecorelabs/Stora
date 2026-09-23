import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyCustomerSession } from '@/lib/supabaseAuth';
import { verifyTryonUploadIntent } from '@/lib/tryonUploadIntent';
import { getObjectMetadata, detectRealImageType } from '@/lib/r2';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function normalizeImageType(contentType) {
  const raw = String(contentType || '').toLowerCase().trim();
  return raw === 'image/jpg' ? 'image/jpeg' : raw;
}

// Mirrors gallery/finalize/route.js's verify-before-trust discipline: the
// client's claim that the PUT succeeded is never trusted on its own --
// getObjectMetadata (a real R2 HeadObject) confirms the object actually
// landed with the right type/size before the upload row is marked usable.
// Goes one step further than gallery's own finalize route: HeadObject's
// ContentType is itself just whatever header the uploader's PUT request
// set (trivially spoofable -- e.g. a plain-text/HTML file uploaded with
// Content-Type: image/jpeg would pass a claim-only check), so this also
// range-reads the object's real leading bytes and sniffs the actual
// format before trusting it as an image at all.
export async function POST(req) {
  try {
    const customerId = await verifyCustomerSession(req);
    if (!customerId) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { uploadId, uploadIntentToken } = await req.json();
    const intent = verifyTryonUploadIntent(uploadIntentToken);

    if (intent.sub !== customerId) {
      return NextResponse.json({ success: false, message: 'Upload intent owner mismatch' }, { status: 403 });
    }

    const { data: upload, error: fetchError } = await supabaseAdmin
      .from('tryon_uploads')
      .select('id, customer_id, r2_key, status')
      .eq('id', uploadId)
      .eq('customer_id', customerId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ success: false, message: 'Upload not found' }, { status: 404 });
    }

    const key = String(intent.key || '');
    if (!key || key !== upload.r2_key) {
      return NextResponse.json({ success: false, message: 'Upload intent key mismatch' }, { status: 403 });
    }

    const expectedType = normalizeImageType(intent.contentType);
    const objectMeta = await getObjectMetadata(key);
    if (!objectMeta) {
      return NextResponse.json({ success: false, message: 'Uploaded image was not found in storage' }, { status: 422 });
    }

    const actualType = normalizeImageType(objectMeta.contentType);
    if (!ALLOWED_IMAGE_TYPES.has(actualType)) {
      return NextResponse.json({ success: false, message: 'Uploaded object is not a supported image type' }, { status: 422 });
    }

    if (expectedType && actualType && expectedType !== actualType) {
      return NextResponse.json({ success: false, message: 'Uploaded image type does not match signed upload intent' }, { status: 422 });
    }

    if (objectMeta.contentLength <= 0 || objectMeta.contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, message: 'Uploaded image exceeds 5MB limit' }, { status: 422 });
    }

    const realType = await detectRealImageType(key);
    if (!realType || !ALLOWED_IMAGE_TYPES.has(realType)) {
      return NextResponse.json({ success: false, message: 'Uploaded file is not a valid image' }, { status: 422 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tryon_uploads')
      .update({ status: 'uploaded' })
      .eq('id', uploadId)
      .eq('customer_id', customerId)
      .select('id')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ success: false, message: 'Failed to finalize upload' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { uploadId: updated.id } });
  } catch (error) {
    console.error('Try-on finalize error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to finalize upload' },
      { status: 500 }
    );
  }
}
