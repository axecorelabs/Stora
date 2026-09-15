import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { deleteFromR2, extractKeyFromUrl } from '@/lib/r2';

// DELETE /api/gallery/[id] -- delete a gallery image and its R2 object
export async function DELETE(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });

    const { id } = await params;

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    // Fetch the item scoped to this store -- prevents a vendor deleting
    // another store's gallery item by guessing a UUID.
    const { data: item } = await supabaseAdmin
      .from('gallery_items')
      .select('id, image_url')
      .eq('id', id)
      .eq('store_id', store.id)
      .maybeSingle();

    if (!item) return NextResponse.json({ success: false, message: 'Item not found' }, { status: 404 });

    await supabaseAdmin.from('gallery_items').delete().eq('id', id);

    // Best-effort R2 delete -- don't block the response if it fails.
    try {
      const key = extractKeyFromUrl(item.image_url);
      if (key) await deleteFromR2(key);
    } catch (r2Error) {
      console.error('R2 delete failed for gallery item:', r2Error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Gallery DELETE error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete image' }, { status: 500 });
  }
}
