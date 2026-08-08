import { NextResponse } from 'next/server';
import { findStoreBySlug, findInventoryByStoreId, buildPublicStoreData } from '@/lib/supabaseStore';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    
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
    
    // Update website metrics (page view)
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
    
    return NextResponse.json({
      ...publicStore,
      owner: store.users,
      products: products
    });
    
  } catch (error) {
    console.error('Error fetching store:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
