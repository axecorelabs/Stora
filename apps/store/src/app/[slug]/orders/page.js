"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { 
  Package, 
  ArrowLeft,
  Clock
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import OrderDetailsPanel from "@/components/orders/OrderDetailsPanel";
import useStoreStore from "@/stores/storeStore";

export default function StoreOrdersPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { isAuthenticated, customer, isLoading: authLoading } = useAuth();
  
  // Get store from Zustand store
  const { currentStore } = useStoreStore();
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [pagination, setPagination] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderPanel, setShowOrderPanel] = useState(false);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/${resolvedParams.slug}`);
    }
  }, [isAuthenticated, authLoading, router, resolvedParams.slug]);

  // Fetch orders
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, activeTab]);

  // Store colors with fallbacks
  const primaryColor = currentStore?.branding?.primaryColor || '#0D9488';
  const secondaryColor = currentStore?.branding?.secondaryColor || '#F3F4F6';
  const currency = currentStore?.settings?.currency || 'NGN';

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
    if (currency === 'NGN') {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
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
    { id: 'previous', label: 'Previous Orders', count: (stats?.completedOrders || 0) + (stats?.cancelledOrders || 0) },
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
          <div 
            className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-4 mb-4 mx-auto"
            style={{ borderTopColor: primaryColor }}
          ></div>
          <p className="text-gray-600">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Store Branding */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push(`/${resolvedParams.slug}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to {currentStore?.storeName || 'Store'}</span>
          </button>

          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
            {currentStore?.branding?.logo && (
              <img 
                src={currentStore.branding.logo} 
                alt={currentStore.storeName} 
                className="h-8 w-auto object-contain opacity-60" 
              />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        {/* Tabs with Store Colors */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'border-b-2'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={activeTab === tab.id ? { 
                color: primaryColor, 
                borderBottomColor: primaryColor 
              } : {}}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No {activeTab} orders
            </h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'upcoming' 
                ? "You don't have any upcoming orders" 
                : "You haven't completed any orders yet"}
            </p>
            <button
              onClick={() => router.push(`/${resolvedParams.slug}`)}
              className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              <Package className="w-5 h-5" />
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order._id}
                onClick={() => handleOrderClick(order)}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Order Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor}20` }}
                      >
                        <Package className="w-6 h-6" style={{ color: primaryColor }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">
                          Order no #{order.orderNumber}
                        </h3>
                        <p className="font-semibold text-lg mb-2" style={{ color: primaryColor }}>
                          {formatPrice(order.totalAmount)}
                        </p>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex gap-3">
                      {/* <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/${resolvedParams.slug}/orders/${order._id}`);
                        }}
                        className="px-6 py-2 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Full Details
                      </button> */}
                      {order.canBeCancelled && (
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="px-6 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Details */}
                <div 
                  className="p-6"
                  style={{ backgroundColor: `${primaryColor}05` }}
                >
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span>{order.itemCount} Items</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>•</span>
                        <span>Pay to vendor</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>•</span>
                        <Clock className="w-4 h-4" />
                        <span>Ordered {formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Store Information */}
                  {order.stores && order.stores.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        {order.stores.length === 1 ? 'Store:' : 'Stores:'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {order.stores.map((store, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg"
                          >
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: `${primaryColor}20` }}
                            >
                              <span className="text-xs font-semibold" style={{ color: primaryColor }}>
                                {store.storeName?.charAt(0)?.toUpperCase() || 'S'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">
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

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <p className="text-sm text-gray-600">
              Page {pagination.currentPage} of {pagination.totalPages}
            </p>
          </div>
        )}
      </div>

      {/* Order Details Panel with Store Colors */}
      <OrderDetailsPanel
        isOpen={showOrderPanel}
        onClose={handleClosePanel}
        order={selectedOrder}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        currency={currency}
      />
    </div>
  );
}
