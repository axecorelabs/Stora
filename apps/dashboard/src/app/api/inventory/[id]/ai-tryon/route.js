import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCommerceApiAccess } from '@/lib/storeAccess';

// Clothing/Shoes need a front (and ideally back) reference so generation
// knows which side of the garment it's looking at -- see
// tryonGeneration.js's own comment on why guessing this from an untagged
// photo produced back-print details showing up on the front. Accessories
// are single-object photos with no front/back to require.
const VIEW_TAGGING_CATEGORIES = new Set(['Clothing', 'Shoes']);

function parseImages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((img) => {
    if (typeof img === 'string') return { url: img };
    return img || {};
  });
}

// PUT - Toggle whether a specific product is eligible for the AI Try-On
// feature. Vendor opt-in, not automatic by category -- exact sibling of
// web-visibility/route.js, plus a real eligibility gate: enabling this on
// a garment with no front-tagged image would just produce a broken
// generation every time, so it's rejected here rather than left to fail
// later at generate-time.
export async function PUT(req, { params }) {
  try {
    const access = await requireCommerceApiAccess(req);
    if (!access.ok) {
      return access.response;
    }
    const { user } = access;

    const { id } = await params;
    const { aiTryonEnabled } = await req.json();

    if (typeof aiTryonEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'aiTryonEnabled must be a boolean value' },
        { status: 400 }
      );
    }

    if (aiTryonEnabled) {
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('inventory')
        .select('id, category, images, store_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !existing) {
        return NextResponse.json({ success: false, message: 'Inventory item not found' }, { status: 404 });
      }

      // AI Try-On is a partner-only feature -- staff-designated
      // (stores.is_partner, see partnership/[contractId]/respond), not
      // something any vendor can flip on for themselves. Checked here,
      // not just hinted at in the UI, since a direct API call must not be
      // able to bypass it.
      const { data: store, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('is_partner')
        .eq('id', existing.store_id)
        .single();

      if (storeError || !store?.is_partner) {
        return NextResponse.json(
          { success: false, message: 'AI Try-On is currently a partner-only feature' },
          { status: 403 }
        );
      }

      if (VIEW_TAGGING_CATEGORIES.has(existing.category)) {
        const images = parseImages(existing.images);
        const hasFront = images.some((img) => img.view === 'front');
        if (!hasFront) {
          return NextResponse.json(
            { success: false, message: 'Tag one product image as "Front" before enabling AI Try-On' },
            { status: 422 }
          );
        }
      }
    }

    const { data: item, error } = await supabaseAdmin
      .from('inventory')
      .update({
        ai_tryon_enabled: Boolean(aiTryonEnabled),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Try-on ${aiTryonEnabled ? 'enabled' : 'disabled'} for this product`,
      data: {
        id: item.id,
        _id: item.id,
        name: item.name,
        productName: item.name,
        aiTryonEnabled: Boolean(item.ai_tryon_enabled)
      }
    });

  } catch (error) {
    console.error('AI try-on toggle error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
