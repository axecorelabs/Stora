import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Name search over unclaimed listings, for the onboarding wizard's
// "is your business already on Stora?" step (see FindBusinessStep.js).
// Deliberately minimal fields -- no store_email/eligibility detail here;
// that's still fetched by GET /api/claims/[storeId] once a result is
// picked, unchanged from Part G.
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const q = new URL(req.url).searchParams.get('q')?.trim() || '';
    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('id, store_name, business_category, state')
      .eq('claim_status', 'unclaimed')
      .ilike('store_name', `%${q}%`)
      .limit(10);

    if (error) {
      console.error('Claims search error:', error);
      return NextResponse.json({ success: false, message: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: (data || []).map((s) => ({
        id: s.id,
        storeName: s.store_name,
        businessCategory: s.business_category,
        state: s.state
      }))
    });
  } catch (error) {
    console.error('Claims search error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
