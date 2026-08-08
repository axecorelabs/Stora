"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Package, 
  ArrowLeft,
  MapPin,
  Phone,
  Clock,
  ChevronRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import OrderDetailsPanel from "@/components/orders/OrderDetailsPanel";

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, customer, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [pagination, setPagination] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, activeTab]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Build status filter array based on active tab
      let statusFilters = [];
      if (activeTab === 'upcoming') {
        statusFilters = ['pending', 'confirmed', 'processing', 'shipped'];
      } else if (activeTab === 'previous') {
        statusFilters = ['delivered', 'cancelled'];
      }
      
      // Build URL with proper status parameters
      const url = new URL('/api/orders', window.location.origin);
      url.searchParams.set('page', '1');
      url.searchParams.set('limit', '20');
      
      // Add each status as a separate parameter
      statusFilters.forEach(status => {
        url.searchParams.append('status', status);
      });
      
      console.log('Fetching orders with URL:', url.toString());
      
      const response = await fetch(url.toString(), {
        credentials: 'include'
      });
      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`Loaded ${data.orders.length} orders for tab: ${activeTab}`);
        setOrders(data.orders);
        setStats(data.stats);
        setPagination(data.pagination);
      } else {
        console.error('Failed to fetch orders:', data.message);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return `₦${price?.toLocaleString()}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      shipped: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const tabs = [
    { id: 'upcoming', label: 'Upcoming Orders', count: stats?.pendingOrders || 0 },
    { id: 'previous', label: 'Previous Orders', count: stats?.completedOrders + stats?.cancelledOrders || 0 },
  ];

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    setShowOrderPanel(true);
  };

  const handleClosePanel = () => {
    setShowOrderPanel(false);
    setTimeout(() => setSelectedOrder(null), 300);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-gray-200 border-t-emerald-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 text-sm sm:text-base">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-optimized Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-3 sm:mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium text-sm sm:text-base">Back</span>
          </button>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Orders</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Mobile-optimized Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 sm:px-6 py-2 sm:py-3 font-medium transition-all relative whitespace-nowrap text-sm sm:text-base ${
                activeTab === tab.id
                  ? 'text-emerald-600 border-b-2 border-emerald-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden sm:inline">{tab.label} ({tab.count})</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]} ({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-8 sm:p-12 text-center">
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📦</div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
              No {activeTab} orders
            </h3>
            <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base px-4">
              {activeTab === 'upcoming' 
                ? "You don't have any upcoming orders" 
                : activeTab === 'previous'
                ? "You haven't completed any orders yet"
                : "You don't have any scheduled orders"}
            </p>
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-emerald-600 text-white rounded-lg sm:rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm sm:text-base"
            >
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {orders.map((order) => (
              <div
                key={order._id}
                onClick={() => handleOrderClick(order)}
                className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Mobile-optimized Order Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg truncate">
                          #{order.orderNumber}
                        </h3>
                        <p className="text-emerald-600 font-semibold text-base sm:text-lg mb-1 sm:mb-2">
                          {formatPrice(order.totalAmount)}
                        </p>
                        {/* Order Status Badge */}
                        <span className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/orders/${order._id}`);
                        }}
                        className="px-3 sm:px-6 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors text-xs sm:text-sm whitespace-nowrap"
                      >
                        <span className="hidden sm:inline">Full Details</span>
                        <span className="sm:hidden">Details</span>
                      </button>
                      {order.canBeCancelled && (
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 sm:px-6 py-1.5 sm:py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors text-xs sm:text-sm whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile-optimized Order Details */}
                <div className="p-4 sm:p-6 bg-gray-50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm text-gray-600">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{order.itemCount} {isMobile ? 'Items' : 'Items'}</span>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span>•</span>
                        <span>{isMobile ? 'Pay vendor' : 'Pay to vendor'}</span>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span>•</span>
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{isMobile ? formatDate(order.createdAt).replace(',', '') : `Ordered ${formatDate(order.createdAt)}`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile-optimized Stores Information */}
                  {order.stores && order.stores.length > 0 && (
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        {order.stores.length === 1 ? 'Store:' : 'Stores:'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {order.stores.map((store, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-white border border-gray-200 rounded-lg"
                          >
                            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-emerald-600">
                                {store.storeName?.charAt(0)?.toUpperCase() || 'S'}
                              </span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[100px] sm:max-w-none">
                                {store.storeName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {store.itemCount} {store.itemCount === 1 ? 'item' : 'items'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile-optimized Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 sm:mt-8 flex items-center justify-center gap-2">
            <p className="text-sm text-gray-600">
              Page {pagination.currentPage} of {pagination.totalPages}
            </p>
          </div>
        )}
      </div>

      {/* Order Details Panel */}
      <OrderDetailsPanel
        isOpen={showOrderPanel}
        onClose={handleClosePanel}
        order={selectedOrder}
      />
    </div>
  );
}
