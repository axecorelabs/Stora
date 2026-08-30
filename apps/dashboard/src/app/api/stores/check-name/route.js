import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// GET - Is this store name already in use by another active store?
//
// store_name is deliberately NOT unique at the DB level (see store_slug's
// UNIQUE constraint and generateUniqueStoreSlug in /api/stores/route.js --
// same split Instagram uses between a unique @handle and a non-unique
// display name). This is a soft, informational check only: it exists so
// CreateStoreModal can warn a vendor their chosen name is already taken by
// someone else (real risk: a shopper mistaking one store for another, or a
// copycat deliberately reusing a real vendor's name), not to block them --
// a name collision is real and legal (two "Mama's Kitchen"s can both
// exist), it just isn't necessarily a good idea.
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const name = req.nextUrl.searchParams.get('name')?.trim();
    if (!name) {
      return NextResponse.json({ success: true, exists: false });
    }

    // Case-insensitive -- "Mama's Kitchen" and "mama's kitchen" read as the
    // same name to a shopper even if they wouldn't slugify identically
    // (they would here, but that's incidental, not the point of this check).
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('id')
      .ilike('store_name', name)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Store name check error:', error);
      // Fail open -- a warning that never shows is a missed nicety, not a
      // broken flow; store creation itself doesn't depend on this check.
      return NextResponse.json({ success: true, exists: false });
    }

    return NextResponse.json({ success: true, exists: !!data });
  } catch (error) {
    console.error('Store name check error:', error);
    return NextResponse.json({ success: true, exists: false });
  }
}
