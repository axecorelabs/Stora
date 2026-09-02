import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Options for the Products page's Store/Category filter dropdowns, plus
// its stat strip -- separate from the main paginated list so both always
// cover every product, not just whatever's on the current 50-row page.
//
// Category/stock rollup comes from fn_admin_product_category_stats (see
// apps/dashboard/supabase/migrations/20260902000001_admin_aggregate_functions.sql)
// -- one grouped SQL query, rather than pulling every non-deleted
// inventory row and every one of their variants into JS to compute the
// same thing.
export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const [
    { data: stores, error: storesError },
    { data: categoryStats, error: categoryError },
    { count: activeCount, error: activeError },
    { count: totalCount, error: totalError }
  ] = await Promise.all([
    supabaseAdmin.from('stores').select('id, store_name').order('store_name', { ascending: true }),
    supabaseAdmin.rpc('fn_admin_product_category_stats', { p_active_only: false }),
    supabaseAdmin.from('inventory').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('is_active', true),
    supabaseAdmin.from('inventory').select('*', { count: 'exact', head: true }).eq('is_deleted', false)
  ]);

  if (storesError || categoryError || activeError || totalError) {
    console.error('Error loading product filters:', storesError || categoryError || activeError || totalError);
    return NextResponse.json({ success: false, message: 'Failed to load filters' }, { status: 500 });
  }

  const categories = (categoryStats || []).map((r) => r.category).sort();
  const outOfStock = (categoryStats || []).reduce((sum, r) => sum + (parseInt(r.out_of_stock_count) || 0), 0);

  return NextResponse.json({
    success: true,
    stores: (stores || []).map((s) => ({ id: s.id, storeName: s.store_name })),
    categories,
    stats: {
      total: totalCount || 0,
      active: activeCount || 0,
      outOfStock,
      categories: categories.length
    }
  });
}
