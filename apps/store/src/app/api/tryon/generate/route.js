import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyCustomerSession } from '@/lib/supabaseAuth';
import { isOverDailyLimit, recordAttempt, releaseAttempt, TRYON_DAILY_LIMIT } from '@/lib/tryonRateLimit';
import { getPublicUrlForKey, deleteFromR2 } from '@/lib/r2';
import { generateTryOnImage } from '@/lib/tryonGeneration';
import { redis, withTimeout, tryonResultKey, TRYON_RESULT_TTL_SECONDS } from '@/lib/redis';

// Clothing/Shoes need a specific front image (and, when tagged, a back
// image too, for the two-panel result) -- generation must never guess
// which of a product's photos shows which side. Accessories have no
// front/back concept, so any image works. See ImageUploadSection.js's
// view-tagging UI and the ai-tryon route's own front-tag gate, which
// already rejects enabling try-on on a garment with no front image --
// this is the second half of that guarantee, read back at generate time.
const VIEW_TAGGING_CATEGORIES = new Set(['Clothing', 'Shoes']);

function parseImages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((img) => (typeof img === 'string' ? { url: img } : (img || {})));
}

function resolveProductImages(item) {
  const images = parseImages(item.images);

  if (!VIEW_TAGGING_CATEGORIES.has(item.category)) {
    const url = item.primary_image || images[0]?.url || null;
    return { frontUrl: url, backUrl: null };
  }

  const frontUrl = images.find((img) => img.view === 'front')?.url || null;
  const backUrl = images.find((img) => img.view === 'back')?.url || null;
  return { frontUrl, backUrl };
}

// Deletes the customer's source photo from R2 the instant it's no longer
// needed -- generation has either succeeded (the photo did its job) or
// failed (it's not going to be retried automatically), so there's no
// reason to let it sit for anywhere near its 48h backstop expiry.
// Best-effort: a delete failure here is caught and logged, not thrown --
// the periodic purge cron is still the backstop for anything that slips
// through (a crash between generation finishing and this call running).
async function deleteSourcePhotoNow(uploadId, r2Key) {
  try {
    await deleteFromR2(r2Key);
    await supabaseAdmin.from('tryon_uploads').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', uploadId);
  } catch (error) {
    console.error(`Failed to immediately delete source photo for upload ${uploadId}:`, error);
  }
}

// Runs after the response is sent (see next/server's after()) -- image
// generation plausibly takes 10-40s+, well past what a customer's browser
// should sit blocked on for one request. The route itself only validates
// and inserts a 'queued' row; this does the actual slow work and updates
// that row's status as it progresses, while the client polls
// GET /api/tryon/generations/[id]. The result itself is cached in Redis
// with a short TTL (tryonResultKey/TRYON_RESULT_TTL_SECONDS), not
// persisted to R2 -- it auto-expires on its own, no cron involvement.
async function processGeneration({ generationId, customerId, uploadId, uploadR2Key, personImageUrl, frontImageUrl, backImageUrl, productName, productCategory }) {
  await supabaseAdmin.from('tryon_generations').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', generationId);

  const result = await generateTryOnImage({ personImageUrl, frontImageUrl, backImageUrl, productName, productCategory });
  await deleteSourcePhotoNow(uploadId, uploadR2Key);

  if (!result.success) {
    await releaseAttempt(customerId);
    await supabaseAdmin.from('tryon_generations').update({
      status: 'failed',
      error_message: result.error,
      updated_at: new Date().toISOString()
    }).eq('id', generationId);
    return;
  }

  try {
    const cachedValue = JSON.stringify({ data: result.buffer.toString('base64'), contentType: result.contentType });
    await withTimeout(redis.set(tryonResultKey(generationId), cachedValue, { ex: TRYON_RESULT_TTL_SECONDS }));
    await supabaseAdmin.from('tryon_generations').update({
      status: 'succeeded',
      model: result.model,
      updated_at: new Date().toISOString()
    }).eq('id', generationId);
  } catch (cacheError) {
    console.error('Failed to cache generated try-on image:', cacheError);
    await releaseAttempt(customerId);
    await supabaseAdmin.from('tryon_generations').update({
      status: 'failed',
      error_message: 'Failed to save generated image',
      updated_at: new Date().toISOString()
    }).eq('id', generationId);
  }
}

export async function POST(req) {
  try {
    const customerId = await verifyCustomerSession(req);
    if (!customerId) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { uploadId, inventoryId } = await req.json();
    if (!uploadId || !inventoryId) {
      return NextResponse.json({ success: false, message: 'uploadId and inventoryId are required' }, { status: 400 });
    }

    // Re-checked here, not just at upload-url -- a customer could
    // otherwise upload once and call generate repeatedly against the
    // same upload to bypass the quota.
    if (await isOverDailyLimit(customerId)) {
      return NextResponse.json(
        { success: false, message: `You've reached today's limit of ${TRYON_DAILY_LIMIT} try-ons. Please try again tomorrow.` },
        { status: 429 }
      );
    }

    const { data: upload, error: uploadError } = await supabaseAdmin
      .from('tryon_uploads')
      .select('id, r2_key, status, expires_at')
      .eq('id', uploadId)
      .eq('customer_id', customerId)
      .single();

    if (uploadError || !upload || upload.status !== 'uploaded' || new Date(upload.expires_at) < new Date()) {
      return NextResponse.json({ success: false, message: 'Upload not found or expired' }, { status: 404 });
    }

    const { data: item, error: itemError } = await supabaseAdmin
      .from('inventory')
      .select('id, name, category, store_id, images, primary_image, ai_tryon_enabled, web_visibility')
      .eq('id', inventoryId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    }

    if (item.ai_tryon_enabled !== true || item.web_visibility === false) {
      return NextResponse.json({ success: false, message: "This product isn't available for try-on" }, { status: 422 });
    }

    const { frontUrl: frontImageUrl, backUrl: backImageUrl } = resolveProductImages(item);
    if (!frontImageUrl) {
      return NextResponse.json({ success: false, message: 'This product has no image to try on' }, { status: 422 });
    }

    const personImageUrl = getPublicUrlForKey(upload.r2_key);
    if (!personImageUrl) {
      return NextResponse.json({ success: false, message: 'Upload storage is not configured' }, { status: 500 });
    }

    const { data: generation, error: insertError } = await supabaseAdmin
      .from('tryon_generations')
      .insert({
        customer_id: customerId,
        upload_id: uploadId,
        inventory_id: inventoryId,
        store_id: item.store_id,
        status: 'queued',
        model: process.env.OPENROUTER_TRYON_MODEL || 'google/gemini-2.5-flash-image',
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      })
      .select('id')
      .single();

    if (insertError || !generation) {
      console.error('Failed to create tryon_generations row:', insertError);
      return NextResponse.json({ success: false, message: 'Failed to start generation' }, { status: 500 });
    }

    await recordAttempt(customerId);

    after(() => processGeneration({
      generationId: generation.id,
      customerId,
      uploadId: upload.id,
      uploadR2Key: upload.r2_key,
      personImageUrl,
      frontImageUrl,
      backImageUrl,
      productName: item.name,
      productCategory: item.category
    }));

    return NextResponse.json({ success: true, data: { generationId: generation.id } });
  } catch (error) {
    console.error('Try-on generate error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to start generation' },
      { status: 500 }
    );
  }
}
