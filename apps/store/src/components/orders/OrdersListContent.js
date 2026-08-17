"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  ArrowLeft,
  Clock
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import OrderDetailsPanel from "@/components/orders/OrderDetailsPanel";

// Shared by /orders (no vendor in context) and /[slug]/orders (reached
// while browsing one vendor's store) -- same reasoning as
// components/cart/CartPageContent.js: this is always the customer's full,
// cross-vendor order history (see the /api/orders call below), so it never
// borrows one vendor's identity for navigation or color, and slug is
// purely optional context for building a "back to that store" link.
const BRAND_PRIMARY = "#145C41";
const BRAND_LIGHT = "#EAF1EE";

export default function OrdersListContent({ slug }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [pagination, setPagination] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderPanel, setShowOrderPanel] = useState(false);

  const homeHref = slug ? `/${slug}` : "/";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(homeHref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, router]);

  const currency = 'NGN';

  const fetchOrders = async () => {
    try {
      setLoading(true);

      let statusFilters = [];
      if (activeTab === 'upcoming') {
        statusFilters = ['pending', 'confirmed', 'processing', 'shipped'];
      } else if (activeTab === 'previous') {
        statusFilters = ['delivered', 'cancelled'];
      }

      const url = new URL('/api/orders', window.location.origin);
      url.searchParams.set('page', '1');
      url.searchParams.set('limit', '20');

      statusFilters.forEach(status => {
        url.searchParams.append('status', status);
      });

      const response = await fetch(url.toString(), {
        credentials: 'include'
      });
      const data = await response.json();

      if (response.ok && data.success) {
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

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeTab]);

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
      <div className="min-h-screen flex items-center justify-center bg-brand-50/40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-brand-100 border-t-brand-700 mb-4 mx-auto"></div>
          <p className="text-brand-800/60 text-sm">Loading your orders…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push(homeHref)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium text-sm">{slug ? "Back to store" : "Home"}</span>
          </button>

          <h1 className="font-display text-2xl md:text-3xl font-semibold text-gray-900">My orders</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium transition-all relative tabular-nums ${
                activeTab === tab.id
                  ? 'border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeTab === tab.id ? {
                color: BRAND_PRIMARY,
                borderBottomColor: BRAND_PRIMARY
              } : {}}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand-50 flex items-center justify-center">
              <Package className="w-7 h-7 text-brand-600" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-xl font-semibold text-gray-900 mb-2">
              No {activeTab} orders
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {activeTab === 'upcoming'
                ? "You don't have any upcoming orders"
                : "You haven't completed any orders yet"}
            </p>
            <button
              onClick={() => router.push(homeHref)}
              className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl text-sm font-semibold hover:brightness-95 transition-all"
              style={{ backgroundColor: BRAND_PRIMARY }}
            >
              <Package className="w-4 h-4" />
              Start shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => handleOrderClick(order)}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] transition-shadow cursor-pointer"
              >
                {/* Order Header */}
                <div className="p-5 md:p-6 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-50">
                      <Package className="w-5 h-5 text-brand-700" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-[15px] truncate">
                        Order #{order.orderNumber}
                      </h3>
                      <p className="font-bold text-lg mb-1.5 tabular-nums" style={{ color: BRAND_PRIMARY }}>
                        {formatPrice(order.totalAmount)}
                      </p>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Details */}
                <div className="p-5 md:p-6 bg-gray-50/60">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="capitalize">{order.payment?.method?.replace('_', ' ') || 'Cash to vendor'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Ordered {formatDate(order.createdAt)}</span>
                    </div>
                  </div>

                  {/* Store Information */}
                  {order.stores && order.stores.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                        {order.stores.length === 1 ? 'Store' : 'Stores'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {order.stores.map((store) => (
                          <div
                            key={store.storeId}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg"
                          >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-brand-50">
                              <span className="text-xs font-semibold text-brand-700">
                                {store.storeName?.charAt(0)?.toUpperCase() || 'S'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">
                                {store.storeName}
                              </span>
                              <span className="text-xs text-gray-500 tabular-nums">
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

      {/* Order Details Panel */}
      <OrderDetailsPanel
        isOpen={showOrderPanel}
        onClose={handleClosePanel}
        order={selectedOrder}
        primaryColor={BRAND_PRIMARY}
        secondaryColor={BRAND_LIGHT}
        currency={currency}
      />
    </div>
  );
}
