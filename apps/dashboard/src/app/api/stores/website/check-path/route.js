import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { normalizeWebsitePath, getWebsitePathShapeError, isWebsitePathTaken } from '@/lib/websitePath';

// GET - Live availability check for a custom website address, used while
// the vendor is still typing (debounced client-side) -- PUT
// /api/stores/website/settings is what actually enforces this at save
// time; this just lets the UI tell them before they commit to one.
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const path = normalizeWebsitePath(req.nextUrl.searchParams.get('path'));

    const shapeError = getWebsitePathShapeError(path);
    if (shapeError) {
      return NextResponse.json({ success: true, available: false, reason: shapeError });
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const taken = await isWebsitePathTaken(path, { excludeStoreId: store?.id });
    if (taken) {
      return NextResponse.json({ success: true, available: false, reason: 'That address is already taken' });
    }

    return NextResponse.json({ success: true, available: true });
  } catch (error) {
    console.error('Website path check error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to check website address' },
      { status: 500 }
    );
  }
}
