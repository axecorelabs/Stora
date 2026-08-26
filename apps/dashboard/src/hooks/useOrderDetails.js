import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

// Single-order counterpart to useOrders (the paginated list hook) -- backs
// the standalone /dashboard/orders/[id] page, which needs one order by id
// rather than a filtered/paginated set.
export function useOrderDetails(orderId) {
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const response = await secureApiCall(`/api/orders/${orderId}`);
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch order');
      }
      return response.data;
    },
    enabled: !!orderId,
    staleTime: 30 * 1000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId: id, updateData }) => {
      const response = await secureApiCall(`/api/orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to update order status');
      }

      return response.data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      // Keeps the Orders list page's own cache in sync too, in case the
      // vendor navigates back to it after updating status from here.
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // OrderDetailsContent (shared with OrderDetailsModal) calls
  // onStatusUpdate(orderId, updateData) as a plain two-arg function --
  // matches the adapter apps/dashboard/src/app/dashboard/orders/page.js
  // already wraps useOrders' mutate in, so this hook exposes the same
  // shape rather than the mutation's own {orderId, updateData} object arg.
  const updateStatus = (id, updateData) => updateStatusMutation.mutateAsync({ orderId: id, updateData });

  return {
    order: orderQuery.data || null,
    isLoading: orderQuery.isLoading,
    isError: orderQuery.isError,
    error: orderQuery.error,
    refetch: orderQuery.refetch,

    updateStatus,
    isUpdating: updateStatusMutation.isLoading,
  };
}
