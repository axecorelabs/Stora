import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { uploadToR2, generateFileKey, validateImageFile, deleteFromR2, extractKeyFromUrl } from '@/lib/r2';

const MAX_GALLERY_IMAGES = 10;

// GET /api/gallery -- return all gallery items for the authenticated store
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, platform_mode')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    const { data: items, error } = await supabaseAdmin
      .from('gallery_items')
      .select('id, image_url, caption, sort_order, created_at')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: items || [] });
  } catch (error) {
    console.error('Gallery GET error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch gallery' }, { status: 500 });
  }
}

// POST /api/gallery -- upload a new gallery image (multipart/form-data: image, caption)
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, platform_mode')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    if (store.platform_mode !== 'listing') {
      return NextResponse.json({ success: false, message: 'Gallery is only available for listing stores' }, { status: 403 });
    }

    // Enforce 10-image cap before uploading.
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

    const formData = await req.formData();
    const file = formData.get('image');
    const caption = formData.get('caption') || null;

    if (!file) return NextResponse.json({ success: false, message: 'No image provided' }, { status: 400 });

    const { buffer, contentType } = await validateImageFile(file);
    const fileKey = generateFileKey(user.id, file.name);
    const imageUrl = await uploadToR2(buffer, fileKey, contentType);

    // sort_order: append at the end.
    const { data: last } = await supabaseAdmin
      .from('gallery_items')
      .select('sort_order')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = last ? last.sort_order + 1 : 0;

    const { data: item, error: insertError } = await supabaseAdmin
      .from('gallery_items')
      .insert({ store_id: store.id, image_url: imageUrl, caption, sort_order: nextOrder })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Gallery POST error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to upload image' }, { status: 500 });
  }
}

// PATCH /api/gallery -- update caption or sort_order for a batch of items
// Body: { items: [{ id, caption?, sort_order? }] }
export async function PATCH(req) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'items array is required' }, { status: 400 });
    }

    // Update each item -- only allow caption and sort_order changes, always
    // scoped to this store so a vendor can't patch another vendor's items.
    for (const item of items) {
      if (!item.id) continue;
      const patch = {};
      if (item.caption !== undefined) patch.caption = item.caption;
      if (item.sort_order !== undefined) patch.sort_order = item.sort_order;
      if (Object.keys(patch).length === 0) continue;

      await supabaseAdmin
        .from('gallery_items')
        .update(patch)
        .eq('id', item.id)
        .eq('store_id', store.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Gallery PATCH error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update gallery' }, { status: 500 });
  }
}
