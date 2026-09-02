import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Toggles the storefront publish flag (stores.website.isEnabled) -- the
// actual public-visibility gate apps/store checks directly
// ([slug]/page.js and siblings) and search_vendors()/search_products()
// both enforce, distinct from stores.is_active (the harder account
// suspend, see /api/stores/[storeId]) and users.is_active (login, see
// /api/users/[userId]). Mirrors the read-modify-write pattern
// apps/dashboard's own stores/website/toggle route uses, minus its
// slug-generation step -- an admin force-toggle doesn't need to invent a
// websitePath for a store its owner never published.
//
// Known gap: apps/admin has no Redis wiring yet, so unlike the vendor's
// own toggle this doesn't bust the storefront cache -- a disabled store
// can stay visible for up to the existing cache TTL rather than
// immediately. Same self-heals-via-TTL fallback the original code already
// accepts, just without the extra immediate-bust step.
export async function PATCH(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { storeId } = await params;
  const { isEnabled } = await request.json();

  if (typeof isEnabled !== 'boolean') {
    return NextResponse.json({ success: false, message: 'isEnabled must be a boolean' }, { status: 400 });
  }

  const { data: store, error: fetchError } = await supabaseAdmin
    .from('stores')
    .select('id, store_name, website')
    .eq('id', storeId)
    .single();

  if (fetchError || !store) {
    return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
  }

  const currentWebsite = typeof store.website === 'string' ? JSON.parse(store.website) : store.website || {};
  const updatedWebsite = { ...currentWebsite, isEnabled, status: isEnabled ? 'active' : 'inactive' };

  const { data, error } = await supabaseAdmin
    .from('stores')
    .update({ website: updatedWebsite })
    .eq('id', storeId)
    .select('id, store_name, website')
    .single();

  if (error || !data) {
    console.error('Error updating storefront status:', error);
    return NextResponse.json({ success: false, message: 'Failed to update store' }, { status: 500 });
  }

  const website = typeof data.website === 'string' ? JSON.parse(data.website) : data.website || {};
  return NextResponse.json({
    success: true,
    store: { id: data.id, storeName: data.store_name, isEnabled: !!website.isEnabled }
  });
}
