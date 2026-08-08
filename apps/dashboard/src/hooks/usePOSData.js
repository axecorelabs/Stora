import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export function usePOSData() {
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();

  // Fetch store information
  const storeQuery = useQuery({
    queryKey: ['store'],
    queryFn: async () => {
      const response = await secureApiCall('/api/stores');
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch inventory items for POS
  const inventoryQuery = useQuery({
    queryKey: ['pos-inventory'],
    queryFn: async () => {
      const response = await secureApiCall('/api/inventory');
      if (response.success && Array.isArray(response.data)) {
        // Filter active items with stock and apply batch pricing
        const activeItems = response.data
          .filter(item => item.status === 'Active' && item.quantityInStock > 0)
          .map(item => ({
            ...item,
            // Use current batch pricing if available, otherwise fall back to item pricing
            sellingPrice: item.currentSellingPrice || item.sellingPrice,
            costPrice: item.currentCostPrice || item.costPrice,
            // Keep original prices for reference
            originalSellingPrice: item.sellingPrice,
            originalCostPrice: item.costPrice,
            // Add batch info for display
            hasBatchPricing: !!(item.currentSellingPrice && item.currentCostPrice),
            batchPricing: item.batchPricing || null
          }));
        return activeItems;
      }
      return [];
    },
    enabled: !!storeQuery.data?.hasStore,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Process sale mutation
  const processSaleMutation = useMutation({
    mutationFn: async (saleData) => {
      const response = await secureApiCall('/api/pos/sales', {
        method: 'POST',
        body: JSON.stringify(saleData)
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to process sale');
      }
      
      return response;
    },
    onSuccess: () => {
      // Invalidate and refetch inventory data after successful sale
      queryClient.invalidateQueries({ queryKey: ['pos-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] }); // Dashboard stats
      queryClient.invalidateQueries({ queryKey: ['inventory-stats-page'] }); // Inventory page stats
    },
    onError: (error) => {
      console.error('Process sale mutation error:', error);
    },
  });

  // Schedule delivery mutation
  const scheduleDeliveryMutation = useMutation({
    mutationFn: async (deliveryData) => {
      const response = await secureApiCall('/api/deliveries', {
        method: 'POST',
        body: JSON.stringify(deliveryData)
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to schedule delivery');
      }
      
      return response;
    },
    onError: (error) => {
      console.error('Schedule delivery mutation error:', error);
    },
  });

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, statusData }) => {
      console.log('Mutation called with:', { orderId, statusData });
      
      const response = await secureApiCall(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify(statusData)
      });
      
      console.log('Order status update response:', response);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to update order status');
      }
      
      return response;
    },
    onSuccess: (data) => {
      console.log('Order status updated successfully:', data);
      // Invalidate orders data
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Update order status mutation error:', error);
    },
  });

  return {
    // Store data with safe defaults
    hasStore: storeQuery.data?.success && storeQuery.data?.hasStore,
    store: storeQuery.data?.data || null,
    storeLoading: storeQuery.isLoading,
    storeError: storeQuery.error,
    
    // Inventory data with safe defaults
    inventoryItems: inventoryQuery.data || [],
    isLoadingInventory: inventoryQuery.isLoading,
    isInventoryError: inventoryQuery.isError,
    inventoryError: inventoryQuery.error,
    
    // Loading states
    isLoading: storeQuery.isLoading || inventoryQuery.isLoading,
    
    // Refetch functions
    refetchInventory: inventoryQuery.refetch,
    refetchStore: storeQuery.refetch,
    
    // Mutations
    processSale: processSaleMutation.mutateAsync,
    scheduleDelivery: scheduleDeliveryMutation.mutateAsync,
    updateOrderStatus: updateOrderStatusMutation.mutateAsync,
    
    // Mutation states
    isProcessingSale: processSaleMutation.isPending,
    isSchedulingDelivery: scheduleDeliveryMutation.isPending,
    isUpdatingOrderStatus: updateOrderStatusMutation.isPending,
    
    // Mutation errors
    processSaleError: processSaleMutation.error,
    scheduleDeliveryError: scheduleDeliveryMutation.error,
    updateOrderStatusError: updateOrderStatusMutation.error,
  };
}
