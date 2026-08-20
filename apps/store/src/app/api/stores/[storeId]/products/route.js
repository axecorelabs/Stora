import { NextResponse } from 'next/server';
import { findStoreById, findInventoryByStoreId, enrichProductsWithBatches, searchStoreProducts } from '@/lib/supabaseStore';

const PAGE_SIZE = 24;

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

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');

    // No pagination params -- unchanged existing behavior (the whole
    // catalog in one call). This is what client-mode's useProducts()
    // still uses, both for its initial fetch and its background
    // revalidation once staleTime passes; server mode never calls this
    // route without `page`.
    if (page === null) {
      const products = await findInventoryByStoreId(storeId);
      const enhancedProducts = await enrichProductsWithBatches(products);

      return NextResponse.json({
        success: true,
        data: enhancedProducts
      });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const sort = searchParams.get('sort') || 'default';

    const { products, totalCount } = await searchStoreProducts(storeId, {
      search,
      category,
      sort,
      limit: PAGE_SIZE,
      offset: (pageNum - 1) * PAGE_SIZE
    });

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: PAGE_SIZE,
        total: totalCount,
        hasMore: pageNum * PAGE_SIZE < totalCount
      }
    });

  } catch (error) {
    console.error('Error fetching store products:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
