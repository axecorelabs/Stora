import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { verifyGalleryUploadIntent } from '@/lib/galleryUploadIntent';
import { getObjectMetadata, getPublicUrlForKey } from '@/lib/r2';

const MAX_GALLERY_IMAGES = 10;
const MAX_DIRECT_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function normalizeImageType(contentType) {
  const raw = String(contentType || '').toLowerCase().trim();
  return raw === 'image/jpg' ? 'image/jpeg' : raw;
}

export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const { uploadIntentToken, caption } = await req.json();
    const intent = verifyGalleryUploadIntent(uploadIntentToken);

    if (intent.sub !== user.id) {
      return NextResponse.json({ success: false, message: 'Upload intent owner mismatch' }, { status: 403 });
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    if (intent.sid !== store.id) {
      return NextResponse.json({ success: false, message: 'Upload intent store mismatch' }, { status: 403 });
    }

    const key = String(intent.key || '');
    const expectedType = normalizeImageType(intent.contentType);

    if (!key) {
      return NextResponse.json({ success: false, message: 'Invalid upload key' }, { status: 400 });
    }

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

    if (objectMeta.contentLength <= 0 || objectMeta.contentLength > MAX_DIRECT_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, message: 'Uploaded image exceeds 5MB limit' }, { status: 422 });
    }

    const { count } = await supabaseAdmin
      .from('gallery_items')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id);

    if ((count || 0) >= MAX_GALLERY_IMAGES) {
      return NextResponse.json(
        { success: false, message: `Gallery is full -- maximum ${MAX_GALLERY_IMAGES} images allowed` },
        { status: 422 }
      );
    }

    const imageUrl = getPublicUrlForKey(key);
    if (!imageUrl) {
      return NextResponse.json({ success: false, message: 'Upload storage URL is not configured' }, { status: 500 });
    }

    const { data: existing } = await supabaseAdmin
      .from('gallery_items')
      .select('id, image_url, caption, sort_order, created_at')
      .eq('store_id', store.id)
      .eq('image_url', imageUrl)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, data: existing });
    }

    const { data: last } = await supabaseAdmin
      .from('gallery_items')
      .select('sort_order')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = last ? last.sort_order + 1 : 0;

    const safeCaption = typeof caption === 'string' ? caption.slice(0, 120) : null;
    const { data: item, error: insertError } = await supabaseAdmin
      .from('gallery_items')
      .insert({ store_id: store.id, image_url: imageUrl, caption: safeCaption, sort_order: nextOrder })
      .select('id, image_url, caption, sort_order, created_at')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Gallery finalize error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to finalize upload' },
      { status: 500 }
    );
  }
}
