import { NextResponse } from 'next/server';
import { findStoreById, findInventoryByStoreId, enrichProductsWithBatches } from '@/lib/supabaseStore';

export async function GET(request, { params }) {
  try {
    const { storeId } = await params;

    const store = await findStoreById(storeId);
    
    if (!store) {
      return NextResponse.json(
        { success: false, message: 'Store not found' },
        { status: 404 }
      );
    }

    // Get products for this store
    const products = await findInventoryByStoreId(storeId);

    // Enhance products with batch pricing
    const enhancedProducts = await enrichProductsWithBatches(products);

    return NextResponse.json({
      success: true,
      data: enhancedProducts
    });

  } catch (error) {
    console.error('Error fetching store products:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
