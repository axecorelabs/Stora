import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { createGalleryUploadIntent } from '@/lib/galleryUploadIntent';
import { generatePresignedUploadUrl, getPublicUrlForKey } from '@/lib/r2';

const MAX_GALLERY_IMAGES = 10;
const MAX_DIRECT_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB after client-side compression
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

function generateGalleryObjectKey(userId, contentType) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).slice(2, 12);
  const extension = extensionForType(contentType);
  return `gallery/${userId}/${timestamp}-${randomString}.${extension}`;
}

export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const contentType = normalizeImageType(body?.contentType);
    const contentLength = Number(body?.contentLength || 0);

    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json(
        { success: false, message: 'Only JPEG, PNG, and WebP images are allowed' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      return NextResponse.json({ success: false, message: 'contentLength is required' }, { status: 400 });
    }

    if (contentLength > MAX_DIRECT_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Image size must be less than 5MB after compression' },
        { status: 422 }
      );
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

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

    const key = generateGalleryObjectKey(user.id, contentType);
    const uploadUrl = await generatePresignedUploadUrl(key, contentType, 5 * 60);
    const publicUrl = getPublicUrlForKey(key);

    if (!publicUrl) {
      return NextResponse.json(
        { success: false, message: 'Upload storage URL is not configured' },
        { status: 500 }
      );
    }

    const uploadIntentToken = createGalleryUploadIntent({
      sub: user.id,
      sid: store.id,
      key,
      contentType,
      contentLength,
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl,
        publicUrl,
        key,
        uploadIntentToken,
        requiredHeaders: {
          'Content-Type': contentType,
        },
        maxBytes: MAX_DIRECT_UPLOAD_BYTES,
      },
    });
  } catch (error) {
    console.error('Gallery upload-url error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to prepare upload' },
      { status: 500 }
    );
  }
}
