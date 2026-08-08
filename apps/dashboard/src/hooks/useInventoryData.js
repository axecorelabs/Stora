import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export function useInventoryData() {
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();

  // Fetch inventory items
  const inventoryQuery = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      try {
        console.log('Fetching inventory items...'); // Debug log
        const response = await secureApiCall('/api/inventory');
        console.log('Inventory items response:', response); // Debug log
        return response.success && Array.isArray(response.data) ? response.data : [];
      } catch (error) {
        console.error('Inventory items fetch error:', error);
        return [];
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    keepPreviousData: true,
    throwOnError: false,
  });

  // Fetch inventory statistics with better validation
  const statsQuery = useQuery({
    queryKey: ['inventory-stats-page'], // CHANGED: Different key from dashboard
    queryFn: async () => {
      try {
        console.log('Fetching inventory stats (page)...'); // Debug log
        const response = await secureApiCall('/api/inventory/stats');
        console.log('Inventory stats response (page):', response); // Debug log
        
        if (response.success && response.data && response.data.overview) {
          // Validate and convert all numeric values
          const overview = response.data.overview;
          return {
            totalItems: Number(overview.totalItems) || 0,
            lowStockItems: Number(overview.lowStockItems) || 0,
            outOfStockItems: Number(overview.outOfStockItems) || 0,
            totalStockValue: Number(overview.totalStockValue) || 0,
            totalSellingValue: Number(overview.totalSellingValue) || 0,
          };
        }
        
        // Return default structure if no data
        console.warn('No stats data returned (page), using defaults');
        return {
          totalItems: 0,
          lowStockItems: 0,
          outOfStockItems: 0,
          totalStockValue: 0,
          totalSellingValue: 0,
        };
      } catch (error) {
        console.error('Inventory stats fetch error (page):', error);
        return {
          totalItems: 0,
          lowStockItems: 0,
          outOfStockItems: 0,
          totalStockValue: 0,
          totalSellingValue: 0,
        };
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    keepPreviousData: true,
    throwOnError: false,
  });

  // Add inventory item mutation
  const addItemMutation = useMutation({
    mutationFn: async (itemData) => {
      const response = await secureApiCall('/api/inventory', {
        method: 'POST',
        body: JSON.stringify(itemData)
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to add item');
      }
      
      return response;
    },
    onSuccess: () => {
      // Invalidate BOTH query keys to keep them in sync
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats-page'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] }); // Also invalidate dashboard
    },
    onError: (error) => {
      console.error('Add item mutation error:', error);
    },
  });

  // Edit inventory item mutation
  const editItemMutation = useMutation({
    mutationFn: async ({ itemId, itemData }) => {
      const response = await secureApiCall(`/api/inventory/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(itemData)
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to update item');
      }
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats-page'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] }); // Also invalidate dashboard
    },
    onError: (error) => {
      console.error('Edit item mutation error:', error);
    },
  });

  // Update stock mutation
  const updateStockMutation = useMutation({
    mutationFn: async ({ itemId, updateData }) => {
      const response = await secureApiCall(`/api/inventory/${itemId}/stock`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to update stock');
      }
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats-page'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] }); // Also invalidate dashboard
    },
    onError: (error) => {
      console.error('Update stock mutation error:', error);
    },
  });

  // Delete inventory item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async ({ itemId, reason = 'No reason provided' }) => {
      const response = await secureApiCall(`/api/inventory/${itemId}/delete?reason=${encodeURIComponent(reason)}`, {
        method: 'DELETE'
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete item');
      }
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats-page'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] }); // Also invalidate dashboard
    },
    onError: (error) => {
      console.error('Delete item mutation error:', error);
    },
  });

  // Extract data with guaranteed safe defaults and validation
  const inventoryData = inventoryQuery.data || [];
  const stats = statsQuery.data ? {
    totalItems: Number(statsQuery.data.totalItems) || 0,
    lowStockItems: Number(statsQuery.data.lowStockItems) || 0,
    outOfStockItems: Number(statsQuery.data.outOfStockItems) || 0,
    totalStockValue: Number(statsQuery.data.totalStockValue) || 0,
    totalSellingValue: Number(statsQuery.data.totalSellingValue) || 0,
  } : null;

  return {
    // Data with safe defaults and validation
    inventoryData,
    stats,
    
    // Loading states
    isLoading: inventoryQuery.isLoading || statsQuery.isLoading,
    isError: inventoryQuery.isError || statsQuery.isError,
    
    // Error objects
    inventoryError: inventoryQuery.error,
    statsError: statsQuery.error,
    
    // Individual loading states
    isLoadingInventory: inventoryQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    
    // Individual fetch statuses for debugging
    inventoryStatus: inventoryQuery.status,
    statsStatus: statsQuery.status,
    
    // Refetch functions
    refetchInventory: inventoryQuery.refetch,
    refetchStats: statsQuery.refetch,
    refetchAll: () => {
      inventoryQuery.refetch();
      statsQuery.refetch();
    },
    
    // Mutations
    addItem: addItemMutation.mutateAsync,
    editItem: editItemMutation.mutateAsync,
    updateStock: updateStockMutation.mutateAsync,
    deleteItem: deleteItemMutation.mutateAsync,
    
    // Mutation states
    isAddingItem: addItemMutation.isPending,
    isEditingItem: editItemMutation.isPending,
    isUpdatingStock: updateStockMutation.isPending,
    isDeletingItem: deleteItemMutation.isPending,
    
    // Mutation errors
    addItemError: addItemMutation.error,
    editItemError: editItemMutation.error,
    updateStockError: updateStockMutation.error,
    deleteItemError: deleteItemMutation.error,
  };
}
