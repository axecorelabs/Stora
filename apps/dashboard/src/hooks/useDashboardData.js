import { useQuery, useQueries } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export function useDashboardData() {
  const { secureApiCall } = useAuth();

  // Check if user has a store - with better error handling
  const storeQuery = useQuery({
    queryKey: ['store'],
    queryFn: async () => {
      try {
        const response = await secureApiCall('/api/stores');
        console.log('Store query response:', response); // Debug log
        return response;
      } catch (error) {
        console.error('Store query error:', error);
        return { success: false, hasStore: false };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    // Don't throw errors, return them instead
    throwOnError: false,
  });

  // Only enable dashboard queries if we have confirmed store data
  const hasStore = Boolean(storeQuery.data?.success && storeQuery.data?.hasStore);
  const isStoreCheckComplete = !storeQuery.isLoading && !storeQuery.isFetching;

  // Fetch all dashboard data in parallel - only when store check is complete
  const dashboardQueries = useQueries({
    queries: [
      {
        queryKey: ['inventory-stats'],
        queryFn: async () => {
          try {
            console.log('Fetching inventory stats...'); // Debug log
            const response = await secureApiCall('/api/inventory/stats');
            console.log('Inventory stats response:', response); // Debug log
            
            if (response.success && response.data && response.data.overview) {
              // Validate the overview data structure
              const overview = response.data.overview;
              return {
                overview: {
                  totalItems: Number(overview.totalItems) || 0,
                  lowStockItems: Number(overview.lowStockItems) || 0,
                  outOfStockItems: Number(overview.outOfStockItems) || 0,
                  totalStockValue: Number(overview.totalStockValue) || 0,
                  totalSellingValue: Number(overview.totalSellingValue) || 0,
                },
                categories: Array.isArray(response.data.categories) ? response.data.categories : []
              };
            }
            
            // Return default structure if no data
            return {
              overview: {
                totalItems: 0,
                lowStockItems: 0,
                outOfStockItems: 0,
                totalStockValue: 0,
                totalSellingValue: 0,
              },
              categories: []
            };
          } catch (error) {
            console.error('Inventory stats error:', error);
            return {
              overview: null,
              categories: []
            };
          }
        },
        enabled: hasStore && isStoreCheckComplete,
        staleTime: 2 * 60 * 1000,
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Keep previous data while refetching
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        queryKey: ['sales-stats'],
        queryFn: async () => {
          try {
            const response = await secureApiCall('/api/pos/sales/stats');
            if (response.success && response.data) {
              return {
                totalSales: Number(response.data.totalSales) || 0,
                totalRevenue: Number(response.data.totalRevenue) || 0,
                weekRevenue: Number(response.data.weekRevenue) || 0,
                monthRevenue: Number(response.data.monthRevenue) || 0,
              };
            }
            return null;
          } catch (error) {
            console.error('Sales stats error:', error);
            return null;
          }
        },
        enabled: hasStore && isStoreCheckComplete,
        staleTime: 1 * 60 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        queryKey: ['recent-sales'],
        queryFn: async () => {
          try {
            const response = await secureApiCall('/api/pos/sales?limit=5');
            if (response.success && response.data && Array.isArray(response.data.sales)) {
              return response.data.sales;
            }
            return [];
          } catch (error) {
            console.error('Recent sales error:', error);
            return [];
          }
        },
        enabled: hasStore && isStoreCheckComplete,
        staleTime: 30 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        queryKey: ['pending-orders'],
        queryFn: async () => {
          try {
            const response = await secureApiCall('/api/orders?status=pending&limit=7&sortBy=createdAt&sortOrder=desc');
            console.log('Pending orders response:', response); // Debug log
            if (response.success && response.data) {
              return {
                orders: Array.isArray(response.data.orders) ? response.data.orders : [],
                total: Number(response.data.pagination?.total) || 0
              };
            }
            return { orders: [], total: 0 };
          } catch (error) {
            console.error('Pending orders error:', error);
            return { orders: [], total: 0 };
          }
        },
        enabled: hasStore && isStoreCheckComplete,
        staleTime: 30 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        queryKey: ['today-orders'],
        queryFn: async () => {
          try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
            const response = await secureApiCall(`/api/orders?createdFrom=${startOfDay}&limit=1`);
            console.log('Today orders response:', response); // Debug log
            return Number(response.data?.pagination?.total) || 0;
          } catch (error) {
            console.error('Today orders error:', error);
            return 0;
          }
        },
        enabled: hasStore && isStoreCheckComplete,
        staleTime: 1 * 60 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
      {
        queryKey: ['top-inventory'],
        queryFn: async () => {
          try {
            const response = await secureApiCall('/api/inventory?limit=10&sortBy=quantityInStock&sortOrder=-1');
            if (response.success && Array.isArray(response.data)) {
              return response.data.slice(0, 3);
            }
            return [];
          } catch (error) {
            console.error('Top inventory error:', error);
            return [];
          }
        },
        enabled: hasStore && isStoreCheckComplete,
        staleTime: 5 * 60 * 1000,
        retry: 2,
        keepPreviousData: true,
        throwOnError: false,
      },
    ],
  });

  // Extract data from queries with safe defaults
  const [
    inventoryStatsQuery,
    salesStatsQuery,
    recentSalesQuery,
    pendingOrdersQuery,
    todayOrdersQuery,
    topItemsQuery,
  ] = dashboardQueries;

  // Better loading state management
  const isLoading = storeQuery.isLoading || 
    (hasStore && isStoreCheckComplete && dashboardQueries.some(q => q.isLoading && !q.data));
  
  const isError = storeQuery.isError || 
    (hasStore && dashboardQueries.some(q => q.isError && !q.data));

  // Extract data with guaranteed safe defaults
  const inventoryStatsData = inventoryStatsQuery.data || { overview: null, categories: [] };
  const inventoryStats = inventoryStatsData.overview;

  return {
    // Store data
    hasStore,
    storeLoading: storeQuery.isLoading,
    storeError: storeQuery.error,
    isStoreCheckComplete,
    
    // Combined loading state
    isLoading,
    isError,
    
    // Individual data with safe defaults and validation
    inventoryStats: inventoryStats ? {
      totalItems: Number(inventoryStats.totalItems) || 0,
      lowStockItems: Number(inventoryStats.lowStockItems) || 0,
      outOfStockItems: Number(inventoryStats.outOfStockItems) || 0,
      totalStockValue: Number(inventoryStats.totalStockValue) || 0,
      totalSellingValue: Number(inventoryStats.totalSellingValue) || 0,
    } : null,
    categoryStats: inventoryStatsData.categories || [],
    salesStats: salesStatsQuery.data || null,
    recentSales: recentSalesQuery.data || [],
    pendingOrders: pendingOrdersQuery.data?.orders || [],
    totalPendingOrders: Number(pendingOrdersQuery.data?.total) || 0,
    todayOrders: Number(todayOrdersQuery.data) || 0,
    topItems: topItemsQuery.data || [],
    
    // Individual loading states for debugging
    isLoadingInventoryStats: inventoryStatsQuery.isLoading,
    isLoadingSalesStats: salesStatsQuery.isLoading,
    isLoadingOrders: pendingOrdersQuery.isLoading,
    
    // Individual errors
    inventoryStatsError: inventoryStatsQuery.error,
    salesStatsError: salesStatsQuery.error,
    recentSalesError: recentSalesQuery.error,
    pendingOrdersError: pendingOrdersQuery.error,
    
    // Refetch functions
    refetchAll: () => {
      storeQuery.refetch();
      dashboardQueries.forEach(q => q.refetch());
    },
    refetchStore: storeQuery.refetch,
    refetchInventory: inventoryStatsQuery.refetch,
    refetchSales: salesStatsQuery.refetch,
    refetchOrders: pendingOrdersQuery.refetch,
  };
}
