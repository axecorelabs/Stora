import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { loadServiceDocument } from '@/lib/services';

export async function GET(request) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({ success: true, data: null });
    }

    const serviceDoc = await loadServiceDocument(store.id);

    return NextResponse.json({
      success: true,
      data: serviceDoc // single service object or null, matching prior behavior
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

// The actual create path is POST /api/services/items (see that route) --
// this file used to also export a POST handler that nothing ever called
// (no frontend caller anywhere in the app), with its own, worse copy of
// the same silent-error-swallowing bugs fixed in items/route.js. Removed
// rather than fixed, since keeping two divergent create paths around is
// itself a hazard for whoever reaches for this one next.
