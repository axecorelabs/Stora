import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Powers the campaign builder's tag autocomplete + per-option "N products
// match" counter -- returns the distinct tags in use across every
// currently-selected store's active, visible inventory (pooled, since a
// campaign can span several vendors now), each with how many products
// carry it. Computed in JS (small dataset even pooled) rather than a
// Postgres jsonb_array_elements query.
export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const storeIds = searchParams.getAll('storeId').filter(Boolean);
  if (storeIds.length === 0) {
    return NextResponse.json({ success: false, message: 'At least one storeId is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select('tags')
    .in('store_id', storeIds)
    .eq('is_active', true)
    .eq('web_visibility', true);

  if (error) {
    console.error('Error loading store tags for campaign builder:', error);
    return NextResponse.json({ success: false, message: 'Failed to load tags' }, { status: 500 });
  }

  const countByTag = new Map();
  for (const row of data || []) {
    const tags = Array.isArray(row.tags) ? row.tags : [];
    for (const tag of tags) {
      countByTag.set(tag, (countByTag.get(tag) || 0) + 1);
    }
  }

  const tags = [...countByTag.entries()]
    .map(([tag, productCount]) => ({ tag, productCount }))
    .sort((a, b) => b.productCount - a.productCount);

  return NextResponse.json({ success: true, tags });
}
