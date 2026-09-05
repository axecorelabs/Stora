import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { computeCombinedSales } from '@/lib/salesStats';

const PAGE_SIZE = 50;

// Lists ALL stores (unlike /api/partners, which is scoped to the
// partner-management screen) -- store + owner login status, verification,
// and lifetime totals, for the Vendors admin screen.
export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const status = searchParams.get('status'); // 'active' | 'suspended'
  const verified = searchParams.get('verified'); // 'verified' | 'pending'
  const offset = parseInt(searchParams.get('offset')) || 0;

  // Applied identically to the paginated list and each stats count query
  // below, so the stat strip always describes the same filtered set the
  // table is showing -- not just whatever happens to be on the page.
  function applyFilters(q_) {
    if (q) q_ = q_.or(`store_name.ilike.%${q}%,store_slug.ilike.%${q}%`);
    if (status === 'active') q_ = q_.eq('is_active', true);
    if (status === 'suspended') q_ = q_.eq('is_active', false);
    if (verified === 'verified') q_ = q_.eq('is_verified', true);
    if (verified === 'pending') q_ = q_.eq('is_verified', false);
    return q_;
  }

  const { data: stores, error, count } = await applyFilters(
    supabaseAdmin
      .from('stores')
      .select('id, store_name, store_slug, owner_id, is_active, is_verified, verification_status, business_verified_at, total_orders, created_at, branding, website', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
  );
  if (error) {
    console.error('Error listing stores:', error);
    return NextResponse.json({ success: false, message: 'Failed to load vendors' }, { status: 500 });
  }

  // Stat strip covers every store matching the current filters, not just
  // this page -- separate unpaginated count queries, same filters applied.
  const [
    { count: totalCount, error: totalError },
    { count: activeCount, error: activeError },
    { count: publishedCount, error: publishedError },
    { count: verifiedCount, error: verifiedCountError }
  ] = await Promise.all([
    applyFilters(supabaseAdmin.from('stores').select('*', { count: 'exact', head: true })),
    applyFilters(supabaseAdmin.from('stores').select('*', { count: 'exact', head: true })).eq('is_active', true),
    applyFilters(supabaseAdmin.from('stores').select('*', { count: 'exact', head: true }))
      .eq('is_active', true)
      .eq('website->>isEnabled', 'true'),
    applyFilters(supabaseAdmin.from('stores').select('*', { count: 'exact', head: true })).eq('is_verified', true)
  ]);
  if (totalError || activeError || publishedError || verifiedCountError) {
    console.error('Error computing vendor stats:', totalError || activeError || publishedError || verifiedCountError);
    return NextResponse.json({ success: false, message: 'Failed to load vendors' }, { status: 500 });
  }

  const ownerIds = [...new Set((stores || []).map((s) => s.owner_id).filter(Boolean))];
  let ownersById = new Map();
  if (ownerIds.length > 0) {
    const { data: owners, error: ownersError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, is_active')
      .in('id', ownerIds);
    if (ownersError) {
      console.error('Error loading store owners:', ownersError);
      return NextResponse.json({ success: false, message: 'Failed to load vendors' }, { status: 500 });
    }
    ownersById = new Map((owners || []).map((o) => [o.id, o]));
  }

  let combinedSalesByStore = new Map();
  try {
    combinedSalesByStore = await computeCombinedSales(
      supabaseAdmin,
      (stores || []).map((s) => ({ id: s.id, ownerId: s.owner_id }))
    );
  } catch (salesError) {
    console.error('Error computing combined sales for vendors list:', salesError);
    return NextResponse.json({ success: false, message: 'Failed to load vendors' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    total: count || 0,
    stats: {
      total: totalCount || 0,
      active: activeCount || 0,
      published: publishedCount || 0,
      verified: verifiedCount || 0
    },
    stores: (stores || []).map((s) => {
      const owner = ownersById.get(s.owner_id);
      const website = typeof s.website === 'string' ? JSON.parse(s.website) : s.website || {};
      const branding = typeof s.branding === 'string' ? JSON.parse(s.branding) : s.branding || {};
      const isPublished = !!website.isEnabled;
      return {
        id: s.id,
        storeName: s.store_name,
        storeSlug: s.store_slug,
        logoUrl: branding.logo || null,
        isActive: !!s.is_active,
        isPublished,
        isLive: !!s.is_active && isPublished,
        // isVerified is the vendor's own identity check (QoreID NIN + live
        // selfie). businessVerified is the separate, staff-granted public
        // "Verified by Stora" badge -- toggled below via PATCH
        // /api/stores/[storeId], not earned automatically by isVerified.
        isVerified: !!s.is_verified,
        verificationStatus: s.verification_status,
        businessVerified: !!s.business_verified_at,
        totalSales: combinedSalesByStore.get(s.id) || 0,
        totalOrders: s.total_orders || 0,
        createdAt: s.created_at,
        owner: owner
          ? {
              id: owner.id,
              name: `${owner.first_name} ${owner.last_name}`.trim(),
              email: owner.email,
              isActive: !!owner.is_active
            }
          : null
      };
    })
  });
}
