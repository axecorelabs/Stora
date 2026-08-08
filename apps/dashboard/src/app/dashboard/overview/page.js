"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import CreateStoreModal from "@/components/dashboard/CreateStoreModal";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { 
  TrendingUp, 
  ShoppingCart,
  ArrowUpRight,
  Receipt,
  Package,
  Store,
  Clock,
  User,
  Phone,
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
    recentSales,
    pendingOrders,
    totalPendingOrders,
    todayOrders,
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

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <div className="space-y-8">
          {/* Hero Section Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Welcome Banner Skeleton */}
            <div className="lg:col-span-8">
              <div className="relative bg-gray-200 rounded-3xl p-8 h-64 animate-pulse overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skeleton-shimmer"></div>
                <div className="relative z-10 space-y-4">
                  <div className="h-4 w-32 bg-gray-300 rounded"></div>
                  <div className="h-10 w-64 bg-gray-300 rounded"></div>
                  <div className="h-4 w-96 bg-gray-300 rounded"></div>
                  <div className="h-12 w-40 bg-gray-300 rounded-xl mt-6"></div>
                </div>
              </div>

              {/* Quick Stats Skeleton */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                      <div className="h-3 w-20 bg-gray-200 rounded"></div>
                    </div>
                    <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 w-32 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Orders Skeleton */}
            <div className="lg:col-span-4">
              <div className="bg-white rounded-2xl p-6 border border-gray-200 h-full animate-pulse">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                  <div className="space-y-2">
                    <div className="h-5 w-32 bg-gray-200 rounded"></div>
                    <div className="h-3 w-24 bg-gray-200 rounded"></div>
                  </div>
                  <div className="h-8 w-12 bg-gray-200 rounded-lg"></div>
                </div>

                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 w-24 bg-gray-200 rounded"></div>
                        <div className="h-3 w-16 bg-gray-200 rounded"></div>
                      </div>
                      <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <div className="h-3 w-16 bg-gray-200 rounded"></div>
                        <div className="h-4 w-20 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access Skeleton */}
          <div>
            <div className="mb-6">
              <div className="h-6 w-32 bg-gray-200 rounded mb-2 animate-pulse"></div>
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden animate-pulse">
                  <div className="h-40 bg-gray-200 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skeleton-shimmer"></div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-white to-gray-50">
                    <div className="h-3 w-20 bg-gray-200 rounded mb-2"></div>
                    <div className="h-5 w-24 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Skeleton */}
          <div>
            <div className="mb-6">
              <div className="h-6 w-40 bg-gray-200 rounded mb-2 animate-pulse"></div>
              <div className="h-4 w-56 bg-gray-200 rounded animate-pulse"></div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 px-4 border-b border-gray-50 last:border-0 animate-pulse">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-gray-200"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-gray-200 rounded"></div>
                        <div className="h-3 w-24 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="h-7 w-20 bg-gray-200 rounded-lg"></div>
                      <div className="w-4 h-4 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
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
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-teal-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to IVMA!</h2>
            <p className="text-gray-500 mb-6">
              To get started with your dashboard and inventory management, you'll need to create your store first.
            </p>
            <button
              onClick={() => setIsCreateStoreModalOpen(true)}
              className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium"
            >
              Create Your Store
            </button>
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

  return (
    <DashboardLayout title="Dashboard Overview" subtitle={getCurrentDate()}>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Welcome Banner */}
          <div className="lg:col-span-8">
            <div className="relative bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 rounded-3xl p-8 overflow-hidden shadow-xl">
              {/* Animated background elements */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
              
              <div className="relative z-10">
                <div className="flex items-center space-x-2 mb-4">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  <p className="text-teal-400 text-sm font-semibold tracking-wide">
                    {getGreeting()}, {user?.firstName || 'User'}
                  </p>
                </div>
                <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
                  Your Business<br />
                  <span className="text-teal-400">Dashboard</span>
                </h1>
                <p className="text-gray-300 text-base mb-8 max-w-md">
                  Track performance, manage operations, and grow your business with real-time insights
                </p>
                <button 
                  onClick={handleNavigateToReports}
                  className="group bg-teal-600 text-white px-8 py-3.5 rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl flex items-center space-x-2"
                >
                  <span>View Reports</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div 
                onClick={handleNavigateToInventory}
                className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-teal-200 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-teal-100 rounded-xl group-hover:bg-teal-600 transition-colors">
                    <Package className="w-5 h-5 text-teal-600 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">INVENTORY</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {isLoadingInventoryStats ? (
                    <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded"></span>
                  ) : (
                    inventoryStats?.totalItems ?? 0
                  )}
                </p>
                <p className="text-xs text-gray-600">Total items in stock</p>
              </div>

              <div 
                onClick={handleNavigateToSales}
                className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-300 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gray-100 rounded-xl group-hover:bg-gray-900 transition-colors">
                    <TrendingUp className="w-5 h-5 text-gray-900 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">SALES</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{salesStats?.totalSales || 0}</p>
                <p className="text-xs text-gray-600">Completed transactions</p>
              </div>

              <div 
                onClick={handleNavigateToOrders}
                className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-orange-200 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-100 rounded-xl group-hover:bg-orange-600 transition-colors">
                    <ShoppingCart className="w-5 h-5 text-orange-600 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">ORDERS</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{totalPendingOrders}</p>
                <p className="text-xs text-gray-600">Awaiting processing</p>
              </div>
            </div>
          </div>

          {/* Pending Orders */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 h-full">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Pending Orders</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Requires action</p>
                </div>
                <span className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold">
                  {totalPendingOrders}
                </span>
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                {pendingOrders.length > 0 ? (
                  pendingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="group border border-gray-100 rounded-xl p-3 hover:border-teal-200 hover:bg-teal-50/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 mb-2">
                        {order.customerSnapshot?.firstName} {order.customerSnapshot?.lastName}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <span className="text-xs text-gray-500">
                          {order.items?.length || 0} items
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(order.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16">
                    <Clock className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No pending orders</p>
                    <p className="text-xs text-gray-400 mt-1">All caught up!</p>
                  </div>
                )}
              </div>

              {totalPendingOrders > 7 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button 
                    onClick={handleNavigateToPendingOrders}
                    className="w-full text-sm text-teal-600 font-medium hover:text-teal-700 flex items-center justify-center space-x-1"
                  >
                    <span>View all {totalPendingOrders} orders</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Quick Access</h2>
              <p className="text-sm text-gray-500 mt-0.5">Jump to your most used features</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Inventory Card */}
            <div 
              onClick={handleNavigateToInventory}
              className="group bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-teal-300 hover:shadow-xl transition-all cursor-pointer"
            >
              <div 
                className="relative h-40 p-5 flex flex-col justify-between overflow-hidden"
                style={{
                  backgroundImage: 'url(https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&auto=format&fit=crop)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-teal-600/95 to-teal-700/95 group-hover:from-teal-700/95 group-hover:to-teal-800/95 transition-colors"></div>
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-semibold tracking-wide">INVENTORY</span>
                </div>
                <div className="text-white relative z-10">
                  <p className="text-3xl font-bold mb-1">{inventoryStats?.totalItems || 0}</p>
                  <p className="text-xs text-white/90">Items in stock</p>
                </div>
              </div>
              <div className="p-4 bg-gradient-to-br from-white to-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 font-medium mb-0.5">Stock Value</p>
                    <p className="text-sm font-bold text-gray-900">
                      {inventoryStats ? formatCurrency(inventoryStats.totalStockValue) : '₦0'}
                    </p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>

            {/* Sales Card */}
            <div 
              onClick={handleNavigateToSales}
              className="group bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-gray-300 hover:shadow-xl transition-all cursor-pointer"
            >
              <div 
                className="relative h-40 p-5 flex flex-col justify-between overflow-hidden"
                style={{
                  backgroundImage: 'url(https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800/95 to-gray-900/95 group-hover:from-gray-900/95 group-hover:to-black/95 transition-colors"></div>
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-semibold tracking-wide">SALES</span>
                </div>
                <div className="text-white relative z-10">
                  <p className="text-3xl font-bold mb-1">{salesStats?.totalSales || 0}</p>
                  <p className="text-xs text-white/90">Total transactions</p>
                </div>
              </div>
              <div className="p-4 bg-gradient-to-br from-white to-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 font-medium mb-0.5">Total Revenue</p>
                    <p className="text-sm font-bold text-gray-900">
                      {salesStats ? formatCurrency(salesStats.totalRevenue) : '₦0'}
                    </p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>

            {/* Orders Card */}
            <div 
              onClick={handleNavigateToOrders}
              className="group bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-orange-300 hover:shadow-xl transition-all cursor-pointer"
            >
              <div 
                className="relative h-40 p-5 flex flex-col justify-between overflow-hidden"
                style={{
                  backgroundImage: 'url(https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&auto=format&fit=crop)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/95 to-orange-600/95 group-hover:from-orange-600/95 group-hover:to-orange-700/95 transition-colors"></div>
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-semibold tracking-wide">ORDERS</span>
                </div>
                <div className="text-white relative z-10">
                  <p className="text-3xl font-bold mb-1">{totalPendingOrders}</p>
                  <p className="text-xs text-white/90">Pending orders</p>
                </div>
              </div>
              <div className="p-4 bg-gradient-to-br from-white to-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 font-medium mb-0.5">Today's Orders</p>
                    <p className="text-sm font-bold text-gray-900">{todayOrders}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
              <p className="text-sm text-gray-500 mt-0.5">Latest transactions and updates</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="space-y-3">
              {recentSales.length > 0 ? recentSales.slice(0, 5).map((sale, index) => (
                <div key={index} className="group flex items-center justify-between py-3 px-4 hover:bg-gradient-to-r hover:from-teal-50/50 hover:to-transparent rounded-xl transition-all cursor-pointer border-b border-gray-50 last:border-0">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                      <Receipt className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        Sale #{sale.transactionId?.slice(-6)}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(sale.saleDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
                      {sale.items.length} items
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
                  </div>
                </div>
              )) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Receipt className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No recent activity</p>
                  <p className="text-xs text-gray-400 mt-1">Activity will appear here</p>
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
