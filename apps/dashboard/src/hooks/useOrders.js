import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export function useOrders({ page = 1, filterBy = 'all', filterValue = '', searchTerm = '' }) {
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();

  // Build query key that includes all filter parameters
  const queryKey = ['orders', { page, filterBy, filterValue, searchTerm }];

  // Fetch orders query
  const ordersQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      
      if (filterBy === 'status' && filterValue) {
        params.append('status', filterValue);
      }
      if (filterBy === 'paymentStatus' && filterValue) {
        params.append('paymentStatus', filterValue);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const url = `/api/orders${params.toString() ? '?' + params.toString() : ''}`;
      const response = await secureApiCall(url);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch orders');
      }
      
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Auto-refetch every 60 seconds (background polling)
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
    keepPreviousData: true, // Keep old data while fetching new (smooth pagination)
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, updateData }) => {
      const response = await secureApiCall(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to update order status');
      }

      return response.data;
    },
    onMutate: async ({ orderId, updateData }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders'] });

      // Snapshot previous value
      const previousOrders = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old;

        return {
          ...old,
          orders: old.orders.map(order =>
            order._id === orderId
              ? {
                  ...order,
                  status: updateData.status,
                  tracking: updateData.trackingInfo || order.tracking,
                  timeline: [
                    ...(order.timeline || []),
                    {
                      status: updateData.status,
                      timestamp: new Date(),
                      note: updateData.note || '',
                      updatedBy: updateData.updatedBy || 'admin'
                    }
                  ]
                }
              : order
          )
        };
      });

      return { previousOrders };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKey, context.previousOrders);
      }
    },
    onSettled: () => {
      // Refetch after mutation settles (success or error)
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Prefetch next page for better UX
  const prefetchNextPage = () => {
    if (ordersQuery.data?.pagination?.hasMore) {
      queryClient.prefetchQuery({
        queryKey: ['orders', { page: page + 1, filterBy, filterValue, searchTerm }],
        queryFn: async () => {
          const params = new URLSearchParams();
          params.append('page', (page + 1).toString());
          params.append('limit', '20');
          
          if (filterBy === 'status' && filterValue) {
            params.append('status', filterValue);
          }
          if (filterBy === 'paymentStatus' && filterValue) {
            params.append('paymentStatus', filterValue);
          }
          if (searchTerm) {
            params.append('search', searchTerm);
          }

          const url = `/api/orders?${params.toString()}`;
          const response = await secureApiCall(url);
          return response.data;
        },
      });
    }
  };

  return {
    // Data
    orders: ordersQuery.data?.orders || [],
    stats: ordersQuery.data?.stats || null,
    pagination: ordersQuery.data?.pagination || { current: 1, pages: 1, total: 0, limit: 20, hasMore: false },
    
    // States
    isLoading: ordersQuery.isLoading,
    isError: ordersQuery.isError,
    isFetching: ordersQuery.isFetching,
    error: ordersQuery.error,
    
    // Actions
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isLoading,
    refetch: ordersQuery.refetch,
    prefetchNextPage,
  };
}
