import { useQuery } from '@tanstack/react-query';

// initialProducts, when provided, seeds this query as TanStack Query
// `initialData` -- combined with staleTime below, this means a page that
// already fetched the same data server-side (SSR) does NOT immediately
// re-fetch it client-side on mount, only once it actually goes stale.
export const useProducts = (storeId, initialProducts) => {
  return useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/products`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch products');
      }

      return data.data;
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    ...(initialProducts !== undefined ? { initialData: initialProducts } : {}),
  });
};
