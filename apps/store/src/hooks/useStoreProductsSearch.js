import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';

// Server mode's data source (see ProductsPageClient.js's `mode` prop) --
// each of search/category/sort is a real network round-trip against
// /api/stores/[storeId]/products, unlike client mode's instant in-memory
// useMemo filtering. An infinite query, not a plain paginated one, so
// "Load more" accumulates pages (like client mode's already-loaded
// array growing) instead of replacing the current page -- getNextPageParam
// reads the same `pagination.hasMore`/`page` shape searchProductsPaginated's
// own route already returns.
//
// `placeholderData: keepPreviousData` keeps the previous search/category/
// sort's results on screen (the caller dims them) while a new one loads,
// rather than blanking the grid on every filter change -- the query key
// intentionally excludes `page` from what resets on a filter change: a
// new search/category/sort always restarts at page 1 (a fresh key), it's
// only page accumulation *within* one filter state that grows.
export function useStoreProductsSearch(storeId, { search, category, sort, initialProducts, initialTotal } = {}) {
  return useInfiniteQuery({
    queryKey: ['store-products-search', storeId, search || '', category || 'all', sort],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), sort });
      if (search) params.set('search', search);
      if (category && category !== 'all') params.set('category', category);

      const response = await fetch(`/api/stores/${storeId}/products?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch products');
      }

      return { products: data.data, pagination: data.pagination };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    // The very first page-1/no-filter/default-sort request is already
    // seeded by SSR (page.js) -- avoids an immediate, redundant refetch of
    // exactly what was just server-rendered.
    ...(!search && (!category || category === 'all') && sort === 'default' && initialProducts !== undefined
      ? {
          initialData: {
            pages: [{
              products: initialProducts,
              pagination: { page: 1, total: initialTotal, hasMore: initialProducts.length < initialTotal }
            }],
            pageParams: [1]
          }
        }
      : {})
  });
}
