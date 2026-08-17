import { NextResponse } from 'next/server';
import { findStoreBySlug, findInventoryByStoreId, buildPublicStoreData } from '@/lib/supabaseStore';
import { supabaseAdmin } from '@/lib/supabase';
import { cacheGet, cacheSet, cacheKey } from '@/lib/redis';

// Every page a shopper visits inside a vendor's storefront re-fetches this
// (see storeStore.js's fetchStore) -- the single hottest read in the app.
// TTL-only, no cross-app invalidation from the dashboard's several store/
// branding-editing routes (see the caching-strategy comment in lib/redis.js
// for why that tradeoff is deliberate here).
const STORE_CACHE_TTL_SECONDS = 120;

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const key = cacheKey.storeBySlug(slug);

    const hit = await cacheGet(key);
    if (hit) {
      return NextResponse.json(hit);
    }

    // Find store by slug with active status
    const store = await findStoreBySlug(slug);

    if (!store) {
      console.log(`Store not found for slug: ${slug}`);
      return NextResponse.json(
        { error: 'Store not found or inactive' },
        { status: 404 }
      );
    }

    // Get store products
    const products = await findInventoryByStoreId(store.id);

    // Update website metrics (page view) -- only on a real cache miss, so
    // this doesn't turn into an extra write on every single pageview; it's
    // an approximate "last actually fetched" signal either way, not a
    // precise view counter.
    try {
      await supabaseAdmin
        .from('stores')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', store.id);
    } catch (error) {
      console.warn('Failed to update metrics:', error.message);
    }

    console.log(`Store found: ${store.store_name} with ${products.length} products`);

    // Return store data with products
    const publicStore = buildPublicStoreData(store);

    const payload = {
      ...publicStore,
      owner: store.users,
      products: products
    };

    await cacheSet(key, payload, STORE_CACHE_TTL_SECONDS);

    return NextResponse.json(payload);

  } catch (error) {
    console.error('Error fetching store:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
