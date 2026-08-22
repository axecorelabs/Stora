"use client";
import { useState, useEffect, Fragment, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import OrderDetailsModal from "@/components/dashboard/OrderDetailsModal";
import OrderStatusUpdateModal from "@/components/dashboard/OrderStatusUpdateModal";
import CustomDropdown from "@/components/ui/CustomDropdown";
import SectionHeader from "@/components/ui/SectionHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/hooks/useOrders";
import {
  ShoppingBag,
  Search,
  Eye,
  Edit,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Phone,
  X,
  ExternalLink,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  AlertTriangle
} from "lucide-react";

// useSearchParams() requires a Suspense boundary above it or Next's build
// fails prerendering this page ("should be wrapped in a suspense
// boundary") -- default export below is just that boundary, real content
// (and the useSearchParams() call) lives in OrdersPageContent.
export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersPageContent() {
  const { secureApiCall } = useAuth();
  const searchParams = useSearchParams();
  // Seeds from ?search= (e.g. the Payments page's "View order" link) --
  // read once on mount, not synced back to the URL as the user types.
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [filterBy, setFilterBy] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [isStatusUpdateModalOpen, setIsStatusUpdateModalOpen] = useState(false);
  const [selectedOrderForUpdate, setSelectedOrderForUpdate] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Use TanStack Query hook
  const {
    orders,
    stats: orderStats,
    pagination,
    isLoading,
    isFetching,
    isError,
    updateStatus,
    isUpdating,
    refetch,
    prefetchNextPage
  } = useOrders({
    page: currentPage,
    filterBy,
    filterValue,
    searchTerm
  });

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Orders' },
    { value: 'status', label: 'Filter by Status' },
    { value: 'paymentStatus', label: 'Filter by Payment' },
    { value: 'dateRange', label: 'Filter by Date' },
    { value: 'store', label: 'Filter by Store' }
  ];

  // Status options - Add 'Processed' status
  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'refunded', label: 'Refunded' }
  ];

  // Payment status options
  const paymentStatusOptions = [
    { value: '', label: 'All Payments' },
    { value: 'pending', label: 'Pending Payment' },
    { value: 'completed', label: 'Paid' },
    { value: 'failed', label: 'Failed' },
    { value: 'processed', label: 'Processed' },
    { value: 'refunded', label: 'Refunded' }
  ];

  // Prefetch next page when user is near the end
  useEffect(() => {
    if (pagination.hasMore) {
      prefetchNextPage();
    }
  }, [currentPage, pagination.hasMore, prefetchNextPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterBy, filterValue, searchTerm]);

  // Update order status using mutation (the mutation itself invalidates the
  // orders query on success, so the list refreshes automatically)
  const updateOrderStatus = async (orderId, updateData) => {
    try {
      await updateStatus({ orderId, updateData });
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  };

  const toggleExpanded = (orderId) => {
    setExpandedOrderId(prev => (prev === orderId ? null : orderId));
  };

  // Debounced search effect with improved logic
  useEffect(() => {
    const handler = setTimeout(() => {
      refetch();
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, filterBy, filterValue, refetch]);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setCurrentPage(newPage);
      // Scroll to top of table
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle status update with new modal
  const handleStatusUpdateClick = (order) => {
    setSelectedOrderForUpdate(order);
    setIsStatusUpdateModalOpen(true);
  };

  // Filter orders based on search and filters
  const getFilteredOrders = () => {
    let filtered = orders;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerSnapshot.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${order.customerSnapshot.firstName} ${order.customerSnapshot.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item => 
          item.productSnapshot.productName.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    return filtered;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color and icon
  const getStatusInfo = (status) => {
    const statusMap = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      processed: { color: 'bg-purple-100 text-purple-800', icon: Package },
      shipped: { color: 'bg-indigo-100 text-indigo-800', icon: Truck },
      delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle },
      refunded: { color: 'bg-gray-100 text-gray-800', icon: DollarSign }
    };
    
    return statusMap[status] || { color: 'bg-gray-100 text-gray-800', icon: Clock };
  };

  // Get payment status color
  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      case 'refunded':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  // Handle filter changes
  const handleFilterByChange = (value) => {
    setFilterBy(value);
    setFilterValue('');
  };

  // Clear filters
  const clearFilters = () => {
    setFilterBy('all');
    setFilterValue('');
    setSearchTerm('');
  };

  // View order details
  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setIsOrderDetailsModalOpen(true);
  };

  const filteredOrders = getFilteredOrders();

  // Stats cards
  const statsCards = orderStats ? [
    {
      title: 'Total Orders',
      value: orderStats.totalOrders.toString(),
      icon: ShoppingBag,
      tone: 'brand',
      description: 'All time orders'
    },
    {
      title: 'Pending Orders',
      value: orderStats.pendingOrders.toString(),
      icon: Clock,
      tone: 'gold',
      description: 'Awaiting processing'
    },
    {
      title: 'Completed Orders',
      value: orderStats.completedOrders.toString(),
      icon: CheckCircle,
      tone: 'brand',
      description: 'Successfully delivered'
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(orderStats.totalRevenue || 0),
      icon: DollarSign,
      tone: 'gold',
      description: 'From all orders'
    }
  ] : [];

  // Show skeleton loader on initial load
  if (isLoading) {
    return (
      <DashboardLayout title="Order Management" subtitle="Manage customer orders and fulfillment">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading orders...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return (
      <DashboardLayout title="Order Management" subtitle="Manage customer orders and fulfillment">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-red-600 mb-4">Failed to load orders</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-brand-800 text-white rounded-lg hover:bg-brand-900"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Order Management" subtitle="Manage customer orders and fulfillment">
      {/* Live Update Indicator */}
      {isFetching && !isLoading && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-brand-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span className="text-sm font-medium">Checking for updates...</span>
          </div>
        </div>
      )}

      {/* Stats Strip - Show cached data while loading */}
      {orderStats && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 lg:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x lg:divide-x divide-gray-100">
          {statsCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="p-4 lg:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                    stat.tone === 'gold' ? 'bg-gold-500/15 text-gold-600' : 'bg-brand-100 text-brand-800'
                  }`}>
                    <IconComponent className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-gray-500">{stat.title}</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {stat.value}
                </p>
                <p className="text-xs text-gray-400 mt-1">{stat.description}</p>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-4 lg:p-6 border-b border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-900 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 lg:w-9 lg:h-9 rounded-xl shrink-0 bg-brand-100 text-brand-800">
                <ShoppingBag className="w-4.5 h-4.5" />
              </span>
              Customer Orders
            </h2>
            <div className="flex items-center flex-wrap gap-3">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full sm:w-48 md:w-64 lg:w-80 bg-gray-50 border-0 rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-brand-800 focus:bg-white text-sm transition-all duration-200"
                />
              </div>

              {/* Filter Type Dropdown */}
              <CustomDropdown
                options={filterOptions}
                value={filterBy}
                onChange={handleFilterByChange}
                placeholder="Filter by..."
                className="w-48"
              />

              {/* Filter Value Dropdown */}
              {filterBy === 'status' && (
                <CustomDropdown
                  options={statusOptions}
                  value={filterValue}
                  onChange={setFilterValue}
                  placeholder="Select status"
                  className="w-48"
                />
              )}

              {filterBy === 'paymentStatus' && (
                <CustomDropdown
                  options={paymentStatusOptions}
                  value={filterValue}
                  onChange={setFilterValue}
                  placeholder="Select payment status"
                  className="w-48"
                />
              )}

              {/* Clear filters */}
              {(filterBy !== 'all' || searchTerm) && (
                <button 
                  onClick={clearFilters}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              )}

              {/* Export button */}
              <button className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-all duration-200">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Active Filters Display */}
          {((filterBy !== 'all' && filterValue)) && (
            <div className="mt-4 flex items-center space-x-2">
              <span className="text-sm text-gray-500">Active filters:</span>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-800">
                  {filterBy === 'status' && `Status: ${statusOptions.find(opt => opt.value === filterValue)?.label}`}
                  {filterBy === 'paymentStatus' && `Payment: ${paymentStatusOptions.find(opt => opt.value === filterValue)?.label}`}
                  <button
                    onClick={() => setFilterValue('')}
                    className="ml-2 text-brand-800 hover:text-brand-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto relative">
          {isFetching && !isLoading && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-brand-100 z-10">
              <div className="h-full bg-brand-800 animate-pulse transition-all" style={{ width: '60%' }}></div>
            </div>
          )}

          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 lg:px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <ShoppingBag className="w-12 h-12 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg font-medium mb-2">No orders found</p>
                      <p className="text-gray-400 text-sm">
                        {orders.length === 0 ? 'No orders have been placed yet' : 'Try adjusting your search or filter criteria'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const statusInfo = getStatusInfo(order.status);
                  const StatusIcon = statusInfo.icon;
                  const isExpanded = expandedOrderId === order.id;
                  const isActionable = ['pending', 'confirmed'].includes(order.status);

                  return (
                    <Fragment key={order.id}>
                      {/* Collapsed row — one line per column, click to expand */}
                      <tr
                        onClick={() => toggleExpanded(order.id)}
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/80' : ''}`}
                      >
                        <td className="px-4 lg:px-6 py-3">
                          <div className="text-sm font-medium text-gray-900">#{order.orderNumber}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            {order.isMultiVendor && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                Multi-vendor
                              </span>
                            )}
                            {order.admin_notes && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Needs review
                              </span>
                            )}
                            {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3">
                          <div className="text-sm font-medium text-gray-900 truncate max-w-[220px]">
                            {order.customerSnapshot.firstName} {order.customerSnapshot.lastName}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[220px]">
                            {order.customerSnapshot.email}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 text-right">
                          <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(order.totalAmount)}</div>
                          <div className={`text-xs whitespace-nowrap ${getPaymentStatusColor(order.paymentInfo.status)}`}>
                            {order.paymentInfo.status.charAt(0).toUpperCase() + order.paymentInfo.status.slice(1)}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-3">
                          <div className="text-sm text-gray-600 whitespace-nowrap">{formatDate(order.createdAt)}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-3">
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </td>
                      </tr>

                      {/* Expanded detail panel — items + quick contact + fulfillment actions */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" className="px-4 md:px-8 py-4 md:py-6 bg-gray-50/60 border-b border-gray-100">
                            {order.admin_notes && (
                              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs md:text-sm text-amber-900">
                                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="font-semibold mb-0.5">Needs review before fulfilling</p>
                                  <p className="whitespace-pre-line">{order.admin_notes}</p>
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                              {/* Items */}
                              <div className="lg:col-span-2">
                                <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-2">
                                  Items
                                </p>
                                <div className="space-y-2">
                                  {order.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-3 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <div className="min-w-0">
                                        <span className="font-medium text-gray-900">{item.productSnapshot.productName}</span>
                                        {item.variant?.size && item.variant?.color && (
                                          <span className="text-brand-800 text-xs ml-1.5">
                                            ({item.variant.color} · {item.variant.size})
                                          </span>
                                        )}
                                        <span className="text-gray-400 text-xs ml-1.5">× {item.quantity}</span>
                                      </div>
                                      <span className="text-gray-900 font-medium whitespace-nowrap">{formatCurrency(item.subtotal)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Contact + payment + actions */}
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  {order.customerSnapshot.phone && (
                                    <div>
                                      <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">Phone</p>
                                      <p className="text-xs md:text-sm font-medium text-gray-900 flex items-center gap-1">
                                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span className="truncate">{order.customerSnapshot.phone}</span>
                                      </p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">Payment</p>
                                    <p className="text-xs md:text-sm font-medium text-gray-900 capitalize">
                                      {order.paymentInfo.method.replace('_', ' ')}
                                    </p>
                                  </div>
                                </div>

                                <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center gap-2">
                                  {isActionable ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); viewOrderDetails(order); }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium bg-brand-800 text-white hover:bg-brand-900 transition-colors"
                                    >
                                      <Package className="w-3.5 h-3.5" />
                                      Process
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); viewOrderDetails(order); }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      View details
                                    </button>
                                  )}

                                  {!['delivered', 'cancelled', 'refunded'].includes(order.status) && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStatusUpdateClick(order); }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                      Update status
                                    </button>
                                  )}

                                  {order.status === 'shipped' && order.tracking.trackingUrl && (
                                    <a
                                      href={order.tracking.trackingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Track package
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Show loading indicator without blocking UI */}
          {isFetching && !isLoading && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-brand-100 z-10">
              <div className="h-full bg-brand-800 animate-pulse transition-all" style={{ width: '60%' }}></div>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {orders.length > 0 && pagination.pages > 1 && (
          <div className="px-4 lg:px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>
                  Showing {((pagination.current - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.current * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} orders
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(pagination.current - 1)}
                  disabled={pagination.current === 1}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    pagination.current === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center space-x-1">
                  {[...Array(pagination.pages)].map((_, index) => {
                    const pageNumber = index + 1;
                    
                    // Show first page, last page, current page, and pages around current
                    if (
                      pageNumber === 1 ||
                      pageNumber === pagination.pages ||
                      (pageNumber >= pagination.current - 1 && pageNumber <= pagination.current + 1)
                    ) {
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            pagination.current === pageNumber
                              ? 'bg-brand-800 text-white'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    } else if (
                      pageNumber === pagination.current - 2 ||
                      pageNumber === pagination.current + 2
                    ) {
                      return <span key={pageNumber} className="px-2 text-gray-400">...</span>;
                    }
                    return null;
                  })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(pagination.current + 1)}
                  disabled={pagination.current === pagination.pages}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    pagination.current === pagination.pages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Summary (only show when no pagination) */}
        {orders.length > 0 && pagination.pages <= 1 && (
          <div className="px-4 lg:px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {filteredOrders.length} of {orders.length} orders
              {searchTerm && ` matching "${searchTerm}"`}
              {filterBy !== 'all' && filterValue && ` with applied filters`}
            </p>
          </div>
        )}
      </div>

      {/* Order Status Update Modal */}
      <OrderStatusUpdateModal
        isOpen={isStatusUpdateModalOpen}
        onClose={() => {
          setIsStatusUpdateModalOpen(false);
          setSelectedOrderForUpdate(null);
        }}
        order={selectedOrderForUpdate}
        onStatusUpdate={updateOrderStatus}
        isUpdating={isUpdating}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => {
          setIsOrderDetailsModalOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onStatusUpdate={updateOrderStatus}
        updatingStatus={isUpdating}
      />
    </DashboardLayout>
  );
}
