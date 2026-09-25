import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const PAGE_SIZE = 50;

// Staff review queue for public "suggest a business" submissions
// (apps/store's /suggest-a-business). Each row here is raw, unverified
// text from an anonymous visitor -- treat it as a lead to check, not a
// fact to publish. Actioning one means staff manually create the real
// listing via POST /api/stores using their own judgment.
export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // 'new' | 'actioned' | 'dismissed'
  const offset = parseInt(searchParams.get('offset')) || 0;

  let query = supabaseAdmin
    .from('business_suggestions')
    .select('id, suggested_name, suggested_category_text, suggested_location_text, submitter_contact, notes, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) {
    console.error('Error listing business suggestions:', error);
    return NextResponse.json({ success: false, message: 'Failed to load suggestions' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    total: count || 0,
    suggestions: (data || []).map((s) => ({
      id: s.id,
      suggestedName: s.suggested_name,
      suggestedCategoryText: s.suggested_category_text,
      suggestedLocationText: s.suggested_location_text,
      submitterContact: s.submitter_contact,
      notes: s.notes,
      status: s.status,
      createdAt: s.created_at
    }))
  });
}
