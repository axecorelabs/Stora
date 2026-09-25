import { NextResponse } from 'next/server';
import { BUSINESS_CATEGORY_VALUES, isValidNigerianState } from '@stora/shared-constants';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { computeCombinedSales } from '@/lib/salesStats';
import { generateUniqueStoreSlug } from '@/lib/storeSlug';

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
  const platformMode = searchParams.get('platform_mode'); // 'store' | 'listing'
  const claimStatus = searchParams.get('claim_status'); // 'unclaimed' | 'claimed'
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
    if (platformMode === 'store') q_ = q_.eq('platform_mode', 'store');
    if (platformMode === 'listing') q_ = q_.eq('platform_mode', 'listing');
    if (claimStatus === 'unclaimed') q_ = q_.eq('claim_status', 'unclaimed');
    if (claimStatus === 'claimed') q_ = q_.eq('claim_status', 'claimed');
    return q_;
  }

  const { data: stores, error, count } = await applyFilters(
    supabaseAdmin
      .from('stores')
      .select('id, store_name, store_slug, owner_id, is_active, is_verified, verification_status, business_verified_at, total_orders, created_at, branding, website, platform_mode, subscription_status, claim_status', { count: 'exact' })
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
        platformMode: s.platform_mode || 'store',
        subscriptionStatus: s.subscription_status || 'none',
        claimStatus: s.claim_status || 'claimed',
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

// POST - Staff seeds an "unclaimed" listing for a real business that
// hasn't signed up yet (Phase 0/1 of the claim-your-business feature --
// the actual claim/verification flow comes later). owner_id stays null.
// platform_mode='listing' + website.isEnabled=true: unclaimed businesses
// are publicly visible for free (isPubliclyVisibleStore() in
// apps/store/src/lib/supabaseStore.js no longer requires a subscription
// for listing-mode stores to exist -- only for premium features like
// reviews/gallery/precise location within the page itself).
export async function POST(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  const storeName = typeof body.storeName === 'string' ? body.storeName.trim() : '';
  if (!storeName) {
    return NextResponse.json({ success: false, message: 'Business name is required' }, { status: 400 });
  }

  let businessCategory = null;
  if (body.businessCategory !== undefined && body.businessCategory !== null && body.businessCategory !== '') {
    const normalized = String(body.businessCategory).trim().toLowerCase();
    if (!BUSINESS_CATEGORY_VALUES.includes(normalized)) {
      return NextResponse.json({ success: false, message: 'Invalid business category' }, { status: 400 });
    }
    businessCategory = normalized;
  }

  let state = null;
  if (body.state !== undefined && body.state !== null && body.state !== '') {
    if (!isValidNigerianState(body.state)) {
      return NextResponse.json({ success: false, message: 'Invalid state' }, { status: 400 });
    }
    state = body.state;
  }

  const storePhone = typeof body.storePhone === 'string' ? body.storePhone.trim() || null : null;
  const storeDescription = typeof body.storeDescription === 'string' ? body.storeDescription.trim() || null : null;
  const addressStreet = typeof body.addressStreet === 'string' ? body.addressStreet.trim() : '';

  try {
    const storeSlug = await generateUniqueStoreSlug(storeName);

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .insert({
        owner_id: null,
        claim_status: 'unclaimed',
        claimed_at: null,
        store_name: storeName,
        store_slug: storeSlug,
        store_description: storeDescription,
        store_phone: storePhone,
        state,
        address: addressStreet ? { street: addressStreet } : {},
        business_category: businessCategory,
        platform_mode: 'listing',
        is_active: true,
        website: { status: 'active', isEnabled: true }
      })
      .select('id, store_name, store_slug, claim_status')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, message: 'A store with that slug already exists, please try again' }, { status: 409 });
      }
      console.error('Error creating unclaimed listing:', error);
      return NextResponse.json({ success: false, message: 'Failed to create listing' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      store: {
        id: store.id,
        storeName: store.store_name,
        storeSlug: store.store_slug,
        claimStatus: store.claim_status
      }
    });
  } catch (error) {
    console.error('Error creating unclaimed listing:', error);
    return NextResponse.json({ success: false, message: 'Failed to create listing' }, { status: 500 });
  }
}
