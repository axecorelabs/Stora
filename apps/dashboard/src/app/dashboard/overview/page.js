"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import CreateStoreModal from "@/components/dashboard/CreateStoreModal";
import SetupChecklist from "@/components/dashboard/SetupChecklist";
import Button from "@/components/ui/Button";
import RevenueTrendChart from "@/components/dashboard/charts/RevenueTrendChart";
import OrdersTrendChart from "@/components/dashboard/charts/OrdersTrendChart";
import CategoryBreakdownChart from "@/components/dashboard/charts/CategoryBreakdownChart";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import ChartCardHeader from "@/components/dashboard/charts/ChartCardHeader";
import {
  TrendingUp,
  ShoppingCart,
  ArrowUpRight,
  Package,
  Store,
  Clock,
  Sparkles
} from "lucide-react";

export default function DashboardOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const [isCreateStoreModalOpen, setIsCreateStoreModalOpen] = useState(false);

  // Use TanStack Query for data fetching
  const {
    hasStore,
    isLoading,
    inventoryStats,
    categoryStats,
    salesStats,
    pendingOrders,
    totalPendingOrders,
    todayOrders,
    salesTrend,
    topItems,
    refetchAll,
    // Add debug states
    isLoadingInventoryStats,
    inventoryStatsError,
  } = useDashboardData();

  // Debug log when inventory stats change
  useEffect(() => {
    if (inventoryStats) {
      console.log('Inventory stats updated:', inventoryStats);
    }
    if (inventoryStatsError) {
      console.error('Inventory stats error:', inventoryStatsError);
    }
  }, [inventoryStats, inventoryStatsError]);

  // Handle store creation
  const handleStoreCreated = (newStore) => {
    setIsCreateStoreModalOpen(false);
    refetchAll(); // Refetch all data after store creation
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Calculate revenue growth percentage
  const getRevenueGrowth = () => {
    if (!salesStats || !salesStats.weekRevenue || !salesStats.monthRevenue) return 0;
    const weeklyAvg = salesStats.weekRevenue / 7;
    const monthlyAvg = salesStats.monthRevenue / 30;
    if (monthlyAvg === 0) return 0;
    return Math.round(((weeklyAvg - monthlyAvg) / monthlyAvg) * 100);
  };

  const getCurrentDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Navigation handlers
  const handleNavigateToReports = () => {
    router.push('/dashboard/reports');
  };

  const handleNavigateToInventory = () => {
    router.push('/dashboard/inventory');
  };

  const handleNavigateToSales = () => {
    router.push('/dashboard/sales');
  };

  const handleNavigateToOrders = () => {
    router.push('/dashboard/orders');
  };

  const handleNavigateToPendingOrders = () => {
    router.push('/dashboard/orders?status=pending,confirmed');
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Dashboard Overview" subtitle={getCurrentDate()}>
        <div className="space-y-4 lg:space-y-6">
          {/* Hero Skeleton -- sized to match the real hero's mobile-first
              dimensions below, so the loading -> loaded transition doesn't
              visibly jump. */}
          <div className="relative bg-gray-200 rounded-2xl lg:rounded-3xl p-5 lg:p-8 h-52 lg:h-64 animate-pulse overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skeleton-shimmer"></div>
            <div className="relative z-10 space-y-3 lg:space-y-4">
              <div className="h-4 w-32 bg-gray-300 rounded"></div>
              <div className="h-8 lg:h-10 w-48 lg:w-64 bg-gray-300 rounded"></div>
              <div className="h-4 w-72 lg:w-96 bg-gray-300 rounded"></div>
              <div className="h-11 lg:h-12 w-36 lg:w-40 bg-gray-300 rounded-xl mt-4 lg:mt-6"></div>
            </div>
          </div>

          {/* Stat strip Skeleton */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 lg:p-5 animate-pulse">
                  <div className="h-3 w-16 bg-gray-200 rounded"></div>
                  <div className="h-6 lg:h-7 w-12 bg-gray-200 rounded mt-3 mb-2"></div>
                  <div className="h-3 w-24 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue + categories Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-4 lg:p-6 border border-gray-200 animate-pulse">
              <div className="h-4 w-20 bg-gray-200 rounded"></div>
              <div className="h-6 lg:h-7 w-24 bg-gray-200 rounded mt-4"></div>
              <div className="h-48 lg:h-56 mt-4 bg-gray-100 rounded-xl"></div>
            </div>
            <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-200 animate-pulse">
              <div className="h-4 w-28 bg-gray-200 rounded mb-4"></div>
              <div className="h-48 lg:h-56 bg-gray-100 rounded-xl"></div>
            </div>
          </div>

          {/* Orders + pending Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-200 animate-pulse">
              <div className="h-4 w-16 bg-gray-200 rounded"></div>
              <div className="h-6 lg:h-7 w-16 bg-gray-200 rounded mt-4"></div>
              <div className="h-48 lg:h-56 mt-4 bg-gray-100 rounded-xl"></div>
            </div>
            <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-200 h-[380px] lg:h-[420px] animate-pulse">
              <div className="h-4 w-28 bg-gray-200 rounded"></div>
              <div className="h-6 lg:h-7 w-12 bg-gray-200 rounded mt-4"></div>
              <div className="h-40 mt-4 bg-gray-100 rounded-xl"></div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          .skeleton-shimmer {
            animation: shimmer 2s infinite;
          }
        `}</style>
      </DashboardLayout>
    );
  }

  if (!hasStore) {
    return (
      <DashboardLayout title="Dashboard Overview" subtitle={getCurrentDate()}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-brand-800" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">Welcome to Stora!</h2>
            <p className="text-gray-500 mb-6">
              To get started with your dashboard and inventory management, you'll need to create your store first.
            </p>
            <Button onClick={() => setIsCreateStoreModalOpen(true)}>
              Create Your Store
            </Button>
          </div>
        </div>

        <CreateStoreModal
          isOpen={isCreateStoreModalOpen}
          onStoreCreated={handleStoreCreated}
        />
      </DashboardLayout>
    );
  }

  const revenueGrowth = getRevenueGrowth();

  const statRows = [
    {
      key: 'inventory',
      icon: Package,
      tone: 'brand',
      label: 'Inventory',
      value: isLoadingInventoryStats ? null : inventoryStats?.totalItems ?? 0,
      sub: inventoryStats ? `${formatCurrency(inventoryStats.totalStockValue)} in stock` : '₦0 in stock',
      onClick: handleNavigateToInventory,
    },
    {
      key: 'sales',
      icon: TrendingUp,
      tone: 'brand',
      label: 'Sales',
      value: salesStats?.totalSales || 0,
      sub: salesStats ? `${formatCurrency(salesStats.totalRevenue)} revenue` : '₦0 revenue',
      onClick: handleNavigateToSales,
    },
    {
      key: 'orders',
      icon: ShoppingCart,
      tone: 'gold',
      label: 'Orders',
      value: totalPendingOrders,
      sub: `${todayOrders} placed today`,
      onClick: handleNavigateToOrders,
    },
  ];

  return (
    <DashboardLayout title="Dashboard Overview" subtitle={getCurrentDate()}>
      <div className="space-y-4 lg:space-y-6">
        <SetupChecklist />
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 rounded-2xl lg:rounded-3xl p-5 lg:p-8 overflow-hidden shadow-xl">
          {/* Animated background elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

          {/* Watermark */}
          <img
            src="/stora.png"
            alt=""
            aria-hidden="true"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-48 h-48 lg:w-80 lg:h-80 object-contain opacity-10 pointer-events-none select-none"
          />

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3 lg:mb-4">
              <Sparkles className="w-5 h-5 text-gold-500" />
              <p className="text-gold-500 text-sm font-semibold tracking-wide">
                {getGreeting()}, {user?.firstName || 'User'}
              </p>
            </div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white mb-2 lg:mb-3 leading-tight">
              Your Business<br />
              <span className="text-gold-500">Dashboard</span>
            </h1>
            <p className="text-sm lg:text-base text-gray-300 mb-6 lg:mb-8 max-w-md">
              Track performance, manage operations, and grow your business with real-time insights
            </p>
            <button
              onClick={handleNavigateToReports}
              className="group bg-gold-500 text-brand-900 px-6 py-3 lg:px-8 lg:py-3.5 rounded-xl text-sm font-semibold hover:bg-gold-400 transition-all shadow-lg hover:shadow-xl flex items-center space-x-2"
            >
              <span>View Reports</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {statRows.map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.key}
                  onClick={row.onClick}
                  className="text-left p-4 lg:p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${row.tone === 'gold' ? 'bg-gold-500/15 text-gold-600' : 'bg-brand-100 text-brand-800'}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-sm text-gray-500">{row.label}</span>
                  </div>
                  {row.value === null ? (
                    <span className="inline-block w-12 h-7 bg-gray-100 animate-pulse rounded"></span>
                  ) : (
                    <p className="text-xl lg:text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.value}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{row.sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Revenue + top categories */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2 h-full">
            <RevenueTrendChart data={salesTrend} growth={revenueGrowth} onViewMore={handleNavigateToSales} />
          </div>
          <CategoryBreakdownChart categories={categoryStats} onViewMore={handleNavigateToInventory} />
        </div>

        {/* Orders + pending orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <OrdersTrendChart data={salesTrend} onViewMore={handleNavigateToOrders} />

          <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-6 h-[380px] lg:h-[420px] flex flex-col">
            <ChartCardHeader icon={Clock} title="Pending orders" onViewMore={handleNavigateToPendingOrders} tone="gold" />

            <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-4">{totalPendingOrders}</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">{todayOrders} orders placed today</p>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar divide-y divide-gray-50">
              {pendingOrders.length > 0 ? (
                pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="group py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        #{order.orderNumber}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(order.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-gray-500 truncate min-w-0">
                        {order.customerSnapshot?.firstName} {order.customerSnapshot?.lastName} · {order.items?.length || 0} items
                      </p>
                      <span className="text-sm font-semibold text-gray-900 shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-9 h-9 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No pending orders</p>
                  <p className="text-xs text-gray-400 mt-1">All caught up!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Store Modal */}
      <CreateStoreModal
        isOpen={isCreateStoreModalOpen}
        onStoreCreated={handleStoreCreated}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </DashboardLayout>
  );
}
