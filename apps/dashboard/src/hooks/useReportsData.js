import { useQuery, useQueries } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const TREND_DAYS = 30;

export function useReportsData() {
  const { secureApiCall } = useAuth();

  // Shares the 'store' cache key with useDashboardData -- navigating between
  // Overview and Reports won't re-fetch this.
  const storeQuery = useQuery({
    queryKey: ['store'],
    queryFn: async () => {
      try {
        return await secureApiCall('/api/stores');
      } catch (error) {
        console.error('Store query error:', error);
        return { success: false, hasStore: false };
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    throwOnError: false,
  });

  const hasStore = Boolean(storeQuery.data?.success && storeQuery.data?.hasStore);
  const isStoreCheckComplete = !storeQuery.isLoading && !storeQuery.isFetching;
  const enabled = hasStore && isStoreCheckComplete;

  const queries = useQueries({
    queries: [
      {
        // Shared cache key with useDashboardData
        queryKey: ['inventory-stats'],
        queryFn: async () => {
          try {
            const response = await secureApiCall('/api/inventory/stats');
            if (response.success && response.data) {
              return {
                overview: response.data.overview || null,
                categories: Array.isArray(response.data.categories) ? response.data.categories : []
              };
            }
            return { overview: null, categories: [] };
          } catch (error) {
            console.error('Inventory stats error:', error);
            return { overview: null, categories: [] };
          }
        },
        enabled,
        staleTime: 2 * 60 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        // Shared cache key with useDashboardData
        queryKey: ['sales-stats'],
        queryFn: async () => {
          try {
            const response = await secureApiCall('/api/pos/sales/stats');
            return response.success ? response.data : null;
          } catch (error) {
            console.error('Sales stats error:', error);
            return null;
          }
        },
        enabled,
        staleTime: 1 * 60 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        queryKey: ['orders-stats'],
        queryFn: async () => {
          try {
            const response = await secureApiCall('/api/orders/stats');
            return response.success ? response.stats : null;
          } catch (error) {
            console.error('Orders stats error:', error);
            return null;
          }
        },
        enabled,
        staleTime: 2 * 60 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        // Distinct key from the dashboard's 14-day 'sales-trend' -- longer range for Reports
        queryKey: ['sales-trend', TREND_DAYS],
        queryFn: async () => {
          try {
            const response = await secureApiCall(`/api/pos/sales/trend?days=${TREND_DAYS}`);
            return response.success && Array.isArray(response.data?.days) ? response.data.days : [];
          } catch (error) {
            console.error('Sales trend error:', error);
            return [];
          }
        },
        enabled,
        staleTime: 2 * 60 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        queryKey: ['top-products', TREND_DAYS],
        queryFn: async () => {
          try {
            const response = await secureApiCall(`/api/pos/sales/top-products?limit=6&days=${TREND_DAYS}`);
            return response.success && Array.isArray(response.data?.products) ? response.data.products : [];
          } catch (error) {
            console.error('Top products error:', error);
            return [];
          }
        },
        enabled,
        staleTime: 2 * 60 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        // Shared cache key with useDashboardData
        queryKey: ['recent-sales'],
        queryFn: async () => {
          try {
            const response = await secureApiCall('/api/pos/sales?limit=6');
            return response.success && Array.isArray(response.data?.sales) ? response.data.sales : [];
          } catch (error) {
            console.error('Recent sales error:', error);
            return [];
          }
        },
        enabled,
        staleTime: 30 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        queryKey: ['upcoming-deliveries'],
        queryFn: async () => {
          try {
            const response = await secureApiCall('/api/deliveries');
            return response.success && Array.isArray(response.data) ? response.data : [];
          } catch (error) {
            console.error('Deliveries error:', error);
            return [];
          }
        },
        enabled,
        staleTime: 60 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
    ],
  });

  const [
    inventoryStatsQuery,
    salesStatsQuery,
    ordersStatsQuery,
    salesTrendQuery,
    topProductsQuery,
    recentSalesQuery,
    deliveriesQuery,
  ] = queries;

  const isLoading = storeQuery.isLoading || (enabled && queries.some(q => q.isLoading && !q.data));
  const isError = storeQuery.isError || (hasStore && queries.some(q => q.isError && !q.data));

  const inventoryStatsData = inventoryStatsQuery.data || { overview: null, categories: [] };

  return {
    hasStore,
    isStoreCheckComplete,
    isLoading,
    isError,

    trendDays: TREND_DAYS,
    inventoryStats: inventoryStatsData.overview,
    categoryStats: inventoryStatsData.categories,
    salesStats: salesStatsQuery.data,
    ordersStats: ordersStatsQuery.data,
    salesTrend: salesTrendQuery.data || [],
    topProducts: topProductsQuery.data || [],
    recentSales: recentSalesQuery.data || [],
    upcomingDeliveries: deliveriesQuery.data || [],

    refetchAll: () => {
      storeQuery.refetch();
      queries.forEach(q => q.refetch());
    },
  };
}
