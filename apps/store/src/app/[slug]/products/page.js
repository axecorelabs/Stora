import { notFound } from 'next/navigation';
import ProductsPageClient from '@/components/product/ProductsPageClient';
import { findStoreBySlug, findInventoryByStoreId, enrichProductsWithBatches } from '@/lib/supabaseStore';

// Generate metadata
export async function generateMetadata({ params }) {
  try {
    const { slug } = await params;
    
    const store = await findStoreBySlug(slug);

    if (!store) {
      return { title: 'Products Not Found' };
    }

    return {
      title: `Products - ${store.storeName}`,
      description: `Browse all products at ${store.storeName}. ${store.storeDescription}`,
      icons: {
        icon: store.branding?.logo || '/favicon.ico',
        apple: store.branding?.logo || '/favicon.ico',
      },
    };
  } catch (error) {
    console.error('Error generating products metadata:', error);
    return { title: 'Products' };
  }
}

export default async function ProductsPage({ params }) {
  const { slug } = await params;
  
  const store = await findStoreBySlug(slug);

  if (!store) {
    notFound();
  }

  // Fetch all active products for this store (already returns camelCase),
  // then apply the same batch-price/stock enrichment the client-side fetch
  // (useProducts -> /api/stores/[storeId]/products) already applies -- SSR
  // and client must render identical data, since useProducts is now seeded
  // with this SSR result as its initialData (see ProductsPageClient.js).
  const rawProducts = await findInventoryByStoreId(store.id, {
    webVisibility: true
  });
  const products = await enrichProductsWithBatches(rawProducts);

  const storeData = JSON.parse(JSON.stringify(store));
  const productsData = JSON.parse(JSON.stringify(products));

  return <ProductsPageClient store={storeData} products={productsData} slug={slug} />;
}
