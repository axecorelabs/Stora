import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export function usePayments({ page = 1, status = '', search = '' }) {
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['payments', { page, status, search }];

  const paymentsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (status) params.append('status', status);
      if (search) params.append('search', search);

      const url = `/api/payments?${params.toString()}`;
      const response = await secureApiCall(url);

      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch payments');
      }

      return response.data;
    },
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    keepPreviousData: true,
  });

  const updateCommissionBearerMutation = useMutation({
    mutationFn: async (commissionBearer) => {
      const response = await secureApiCall('/api/stores/commission-bearer', {
        method: 'PATCH',
        body: JSON.stringify({ commissionBearer })
      });
      if (!response.success) {
        throw new Error(response.message || 'Failed to update commission preference');
      }
      return response.data;
    },
    onSuccess: () => {
      // Only future orders snapshot the new mode -- nothing about past
      // transactions changes, so a plain invalidate (not an optimistic
      // patch of past rows) is correct here.
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    }
  });

  const prefetchNextPage = () => {
    if (paymentsQuery.data?.pagination?.hasMore) {
      queryClient.prefetchQuery({
        queryKey: ['payments', { page: page + 1, status, search }],
        queryFn: async () => {
          const params = new URLSearchParams();
          params.append('page', (page + 1).toString());
          params.append('limit', '20');
          if (status) params.append('status', status);
          if (search) params.append('search', search);

          const response = await secureApiCall(`/api/payments?${params.toString()}`);
          return response.data;
        },
      });
    }
  };

  return {
    transactions: paymentsQuery.data?.transactions || [],
    stats: paymentsQuery.data?.stats || null,
    payoutAccount: paymentsQuery.data?.payoutAccount || null,
    commissionBearer: paymentsQuery.data?.commissionBearer || 'vendor',
    commissionRate: paymentsQuery.data?.commissionRate ?? 0.02,
    minimumCommission: paymentsQuery.data?.minimumCommission ?? 200,
    nextPayout: paymentsQuery.data?.nextPayout || null,
    pagination: paymentsQuery.data?.pagination || { current: 1, pages: 1, total: 0, limit: 20, hasMore: false },

    isLoading: paymentsQuery.isLoading,
    isError: paymentsQuery.isError,
    isFetching: paymentsQuery.isFetching,
    error: paymentsQuery.error,

    refetch: paymentsQuery.refetch,
    prefetchNextPage,

    updateCommissionBearer: updateCommissionBearerMutation.mutateAsync,
    isUpdatingCommissionBearer: updateCommissionBearerMutation.isLoading,
  };
}
