import { useQuery } from '@tanstack/react-query';

export const useProducts = (storeId) => {
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
  });
};
