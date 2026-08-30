import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ProductsPageClient from '@/components/product/ProductsPageClient';
import {
  findStoreBySlug,
  findInventoryByStoreId,
  enrichProductsWithBatches,
  countStoreProducts,
  searchStoreProducts,
  getStoreCategories
} from '@/lib/supabaseStore';

// Below this, fetch-everything-and-filter-client-side (today's behavior)
// stays instant and is genuinely the right call. Above it, real
// server-side search/filter/sort/pagination -- see
// ProductsPageClient.js's `mode` prop. Decided here, server-side, as part
// of this same request (one cheap indexed count), never as a separate
// client round-trip to "find out" which mode to use.
const SERVER_MODE_THRESHOLD = 170;
const SERVER_MODE_PAGE_SIZE = 24;

// ISR: a 1-minute window for the listing itself. ProductsPageClient already
// re-syncs live via useProducts() (TanStack Query, 5-min staleTime) on top
// of this SSR/ISR snapshot, so actual staleness is bounded well under this
// either way -- this just controls how fresh the very first paint is.
export const revalidate = 60;

// Required for revalidate to take effect on this dynamic segment -- see
// the matching comment in ../page.js.
export async function generateStaticParams() {
  return [];
}

// Generate metadata
export async function generateMetadata({ params }) {
  try {
    const { slug } = await params;
    
    const store = await findStoreBySlug(slug);

    if (!store || !store.website?.isEnabled) {
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

  if (!store || !store.website?.isEnabled) {
    notFound();
  }

  const totalCount = await countStoreProducts(store.id);
  const storeData = JSON.parse(JSON.stringify(store));

  let clientProps;
  if (totalCount <= SERVER_MODE_THRESHOLD) {
    // Fetch all active products for this store (already returns camelCase),
    // then apply the same batch-price/stock enrichment the client-side fetch
    // (useProducts -> /api/stores/[storeId]/products) already applies -- SSR
    // and client must render identical data, since useProducts is now seeded
    // with this SSR result as its initialData (see ProductsPageClient.js).
    const rawProducts = await findInventoryByStoreId(store.id);
    const products = await enrichProductsWithBatches(rawProducts);
    clientProps = { mode: 'client', products: JSON.parse(JSON.stringify(products)) };
  } else {
    // Server mode: only ever fetch one page server-side -- the point of
    // this branch is that the full catalog is never pulled into memory,
    // client or server. `categories` has to be fetched separately here
    // (fn_store_categories) since there's no full product array to derive
    // it from client-side the way client mode's useMemo does.
    const [{ products, totalCount: initialTotal }, categories] = await Promise.all([
      searchStoreProducts(store.id, { sort: 'default', limit: SERVER_MODE_PAGE_SIZE, offset: 0 }),
      getStoreCategories(store.id)
    ]);
    clientProps = {
      mode: 'server',
      products: JSON.parse(JSON.stringify(products)),
      initialTotal,
      categories: JSON.parse(JSON.stringify(categories))
    };
  }

  // ProductsPageClient reads useSearchParams() (for ?category=) with no
  // Suspense boundary of its own -- pre-existing, but harmless under pure
  // dynamic SSR. It becomes a hard error once this route is ISR-eligible
  // (generateStaticParams above): Next can't produce a cacheable shell
  // around a client subtree that needs searchParams without a fallback to
  // render statically first. The Suspense boundary has to live here, in
  // the server parent, not inside the client component itself.
  return (
    <Suspense fallback={null}>
      <ProductsPageClient store={storeData} slug={slug} {...clientProps} />
    </Suspense>
  );
}
