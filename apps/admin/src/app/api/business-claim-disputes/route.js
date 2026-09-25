import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const PAGE_SIZE = 50;

// Staff review queue for "report this listing" submissions (apps/store's
// listing pages) -- the safety net for the dashboard's unverified
// self-attach claim path. Upholding one revokes the claim (see the
// [disputeId] PATCH route).
export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // 'new' | 'reviewing' | 'upheld' | 'dismissed'
  const offset = parseInt(searchParams.get('offset')) || 0;

  let query = supabaseAdmin
    .from('business_claim_disputes')
    .select('id, store_id, reporter_name, reporter_email, reporter_phone, relationship, details, status, created_at, stores(store_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) {
    console.error('Error listing business claim disputes:', error);
    return NextResponse.json({ success: false, message: 'Failed to load disputes' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    total: count || 0,
    disputes: (data || []).map((d) => ({
      id: d.id,
      storeId: d.store_id,
      storeName: d.stores?.store_name || null,
      reporterName: d.reporter_name,
      reporterEmail: d.reporter_email,
      reporterPhone: d.reporter_phone,
      relationship: d.relationship,
      details: d.details,
      status: d.status,
      createdAt: d.created_at
    }))
  });
}
