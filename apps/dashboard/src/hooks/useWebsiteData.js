import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export function useWebsiteData() {
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();

  // Fetch store information
  const storeQuery = useQuery({
    queryKey: ['store'],
    queryFn: async () => {
      try {
        const response = await secureApiCall('/api/stores');
        return response;
      } catch (error) {
        console.error('Store query error:', error);
        return { success: false, hasStore: false };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    keepPreviousData: true,
    throwOnError: false,
  });

  // Fetch preview products
  const previewProductsQuery = useQuery({
    queryKey: ['website-preview-products'],
    queryFn: async () => {
      try {
        const response = await secureApiCall('/api/inventory?limit=3&status=Active');
        if (response.success && Array.isArray(response.data)) {
          return response.data.filter(item => item.quantityInStock > 0).slice(0, 3);
        }
        return [];
      } catch (error) {
        console.error('Preview products fetch error:', error);
        return [];
      }
    },
    enabled: !!(storeQuery.data?.success && storeQuery.data?.hasStore),
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    keepPreviousData: true,
    throwOnError: false,
  });

  // Toggle website status mutation
  const toggleWebsiteMutation = useMutation({
    mutationFn: async (newStatus) => {
      const response = await secureApiCall('/api/stores/website/toggle', {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to toggle website status');
      }
      
      return response;
    },
    onSuccess: (response) => {
      // Update the store cache
      queryClient.setQueryData(['store'], (oldData) => ({
        ...oldData,
        data: response.data
      }));
    },
    onError: (error) => {
      console.error('Toggle website mutation error:', error);
    },
  });

  // Update store branding mutation
  const updateBrandingMutation = useMutation({
    mutationFn: async (brandingData) => {
      const response = await secureApiCall('/api/stores/branding', {
        method: 'PUT',
        body: JSON.stringify(brandingData)
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to update branding');
      }
      
      return response;
    },
    onSuccess: (response) => {
      // Update the store cache
      queryClient.setQueryData(['store'], (oldData) => ({
        ...oldData,
        data: response.data
      }));
    },
    onError: (error) => {
      console.error('Update branding mutation error:', error);
    },
  });

  return {
    // Store data with safe defaults
    hasStore: Boolean(storeQuery.data?.success && storeQuery.data?.hasStore),
    store: storeQuery.data?.data || null,
    storeLoading: storeQuery.isLoading,
    storeError: storeQuery.error,
    
    // Preview products
    previewProducts: previewProductsQuery.data || [],
    isLoadingPreviewProducts: previewProductsQuery.isLoading,
    previewProductsError: previewProductsQuery.error,
    
    // Combined loading state
    isLoading: storeQuery.isLoading,
    isInitialLoading: storeQuery.isLoading && !storeQuery.data,
    
    // Refetch functions
    refetchStore: storeQuery.refetch,
    refetchPreviewProducts: previewProductsQuery.refetch,
    
    // Mutations
    toggleWebsite: toggleWebsiteMutation.mutateAsync,
    updateBranding: updateBrandingMutation.mutateAsync,
    
    // Mutation states
    isTogglingWebsite: toggleWebsiteMutation.isPending,
    isUpdatingBranding: updateBrandingMutation.isPending,
    
    // Mutation errors
    toggleWebsiteError: toggleWebsiteMutation.error,
    updateBrandingError: updateBrandingMutation.error,
  };
}
