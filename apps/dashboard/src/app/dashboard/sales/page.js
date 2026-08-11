"use client";
import { useState, useEffect, Fragment } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import CustomDropdown from "@/components/ui/CustomDropdown";
import ReceiptModal from "@/components/dashboard/ReceiptModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  Receipt,
  Calendar,
  DollarSign,
  TrendingUp,
  Eye,
  Search,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function SalesPage() {
  const { secureApiCall } = useAuth();
  const [sales, setSales] = useState([]);
  const [salesStats, setSalesStats] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Sales' },
    { value: 'paymentMethod', label: 'Filter by Payment Method' },
    { value: 'dateRange', label: 'Filter by Date Range' },
    { value: 'amount', label: 'Filter by Amount' }
  ];

  // Payment method options
  const paymentMethodOptions = [
    { value: '', label: 'All Payment Methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'transfer', label: 'Bank Transfer' },
    { value: 'pos', label: 'POS/Card' }
  ];

  // Amount range options
  const amountRangeOptions = [
    { value: '', label: 'All Amounts' },
    { value: '0-1000', label: '₦0 - ₦1,000' },
    { value: '1000-5000', label: '₦1,000 - ₦5,000' },
    { value: '5000-10000', label: '₦5,000 - ₦10,000' },
    { value: '10000-50000', label: '₦10,000 - ₦50,000' },
    { value: '50000+', label: '₦50,000+' }
  ];

  // Fetch sales data
  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());

      if (filterBy === 'paymentMethod' && filterValue) {
        params.append('paymentMethod', filterValue);
      }
      if (filterBy === 'dateRange' && dateRange.startDate) {
        params.append('startDate', dateRange.startDate);
      }
      if (filterBy === 'dateRange' && dateRange.endDate) {
        params.append('endDate', dateRange.endDate);
      }

      const url = `/api/pos/sales?${params.toString()}`;
      const response = await secureApiCall(url);

      if (response.success) {
        setSales(response.data.sales);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sales statistics
  const fetchSalesStats = async () => {
    try {
      const response = await secureApiCall('/api/pos/sales/stats');
      if (response.success) {
        setSalesStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching sales stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchSales(), fetchSalesStats()]);
    };
    loadData();
  }, [filterBy, filterValue, dateRange, currentPage, pageSize]);

  // Every filter change jumps back to page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [filterBy, filterValue, dateRange]);

  const toggleExpanded = (saleId) => {
    setExpandedSaleId(prev => (prev === saleId ? null : saleId));
  };

  // Filter sales based on search and filters
  const getFilteredSales = () => {
    let filtered = sales;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(sale =>
        sale.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.customer.phone.includes(searchTerm) ||
        sale.items.some(item => 
          item.productName.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply amount range filter
    if (filterBy === 'amount' && filterValue) {
      filtered = filtered.filter(sale => {
        const amount = sale.total;
        switch (filterValue) {
          case '0-1000':
            return amount >= 0 && amount <= 1000;
          case '1000-5000':
            return amount > 1000 && amount <= 5000;
          case '5000-10000':
            return amount > 5000 && amount <= 10000;
          case '10000-50000':
            return amount > 10000 && amount <= 50000;
          case '50000+':
            return amount > 50000;
          default:
            return true;
        }
      });
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

  // Get payment method icon
  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash':
        return <Banknote className="w-4 h-4" />;
      case 'transfer':
        return <Smartphone className="w-4 h-4" />;
      case 'pos':
        return <CreditCard className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  // Handle filter changes
  const handleFilterByChange = (value) => {
    setFilterBy(value);
    setFilterValue('');
    setDateRange({ startDate: '', endDate: '' });
  };

  const handleFilterValueChange = (value) => {
    setFilterValue(value);
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Clear filters
  const clearFilters = () => {
    setFilterBy('all');
    setFilterValue('');
    setDateRange({ startDate: '', endDate: '' });
    setSearchTerm('');
  };

  // View receipt
  const viewReceipt = (sale) => {
    setSelectedSale(sale);
    setIsReceiptModalOpen(true);
  };

  // Sales stats cards
  const statsCards = salesStats ? [
    {
      title: 'Total Sales',
      value: salesStats.totalSales.toString(),
      icon: Receipt,
      tone: 'brand',
      description: 'All time sales count'
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(salesStats.totalRevenue),
      icon: DollarSign,
      tone: 'gold',
      description: 'All time revenue'
    },
    {
      title: 'Average Sale',
      value: formatCurrency(salesStats.avgSaleAmount),
      icon: TrendingUp,
      tone: 'brand',
      description: 'Average per transaction'
    },
    {
      title: "Today's Sales",
      value: salesStats.todaySales?.toString() || '0',
      icon: Calendar,
      tone: 'gold',
      description: 'Sales made today'
    }
  ] : [];

  if (loading) {
    return (
      <DashboardLayout title="Sales Management" subtitle="View and manage all sales transactions">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading sales data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Sales Management" subtitle="View and manage all sales transactions">
      {/* Stats Strip */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x lg:divide-x divide-gray-100">
          {statsCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                    stat.tone === 'gold' ? 'bg-gold-500/15 text-gold-600' : 'bg-brand-100 text-brand-800'
                  }`}>
                    <IconComponent className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-gray-500">{stat.title}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {stat.value}
                </p>
                <p className="text-xs text-gray-400 mt-1">{stat.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sales Overview */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-brand-100 text-brand-800">
                <Receipt className="w-4.5 h-4.5" />
              </span>
              Sales Transactions
            </h2>
            <div className="flex items-center flex-wrap gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-80 bg-gray-50 border-0 rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-brand-800 focus:bg-white text-sm transition-all duration-200"
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
              {filterBy === 'paymentMethod' && (
                <CustomDropdown
                  options={paymentMethodOptions}
                  value={filterValue}
                  onChange={handleFilterValueChange}
                  placeholder="Select payment method"
                  className="w-48"
                />
              )}

              {filterBy === 'amount' && (
                <CustomDropdown
                  options={amountRangeOptions}
                  value={filterValue}
                  onChange={handleFilterValueChange}
                  placeholder="Select amount range"
                  className="w-48"
                />
              )}

              {/* Date Range Inputs */}
              {filterBy === 'dateRange' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-800 text-sm"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-800 text-sm"
                  />
                </div>
              )}

              {/* Clear filters button */}
              {(filterBy !== 'all' || searchTerm) && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {((filterBy !== 'all' && filterValue) || (filterBy === 'dateRange' && (dateRange.startDate || dateRange.endDate))) && (
            <div className="mt-4 flex items-center space-x-2">
              <span className="text-sm text-gray-500">Active filters:</span>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-900">
                  {filterBy === 'paymentMethod' && `Payment: ${paymentMethodOptions.find(opt => opt.value === filterValue)?.label}`}
                  {filterBy === 'amount' && `Amount: ${amountRangeOptions.find(opt => opt.value === filterValue)?.label}`}
                  {filterBy === 'dateRange' && `Date: ${dateRange.startDate || 'Any'} to ${dateRange.endDate || 'Any'}`}
                  <button
                    onClick={() => {
                      setFilterValue('');
                      setDateRange({ startDate: '', endDate: '' });
                    }}
                    className="ml-2 text-brand-800 hover:text-brand-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sales Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {getFilteredSales().length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Receipt className="w-12 h-12 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg font-medium mb-2">No sales found</p>
                      <p className="text-gray-400 text-sm">
                        {sales.length === 0 ? 'No sales have been made yet' : 'Try adjusting your search or filter criteria'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                getFilteredSales().map((sale) => {
                  const isExpanded = expandedSaleId === sale.id;

                  return (
                    <Fragment key={sale.id}>
                      {/* Collapsed row — one line per column, click to expand */}
                      <tr
                        onClick={() => toggleExpanded(sale.id)}
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/80' : ''}`}
                      >
                        <td className="px-6 py-3">
                          <div className="text-sm font-mono text-gray-900">{sale.transactionId}</div>
                          <div className="text-xs text-gray-500">{formatDate(sale.saleDate)}</div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                            {sale.customer.name || 'Walk-in Customer'}
                          </div>
                          {sale.customer.phone && (
                            <div className="text-xs text-gray-500">{sale.customer.phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-1.5 text-sm text-gray-700 capitalize">
                            <span className="text-gray-400">{getPaymentMethodIcon(sale.paymentMethod)}</span>
                            {sale.paymentMethod}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(sale.total)}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                            sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                            sale.status === 'refunded' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </td>
                      </tr>

                      {/* Expanded detail panel — itemized breakdown + receipt action */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" className="px-6 md:px-8 py-5 md:py-6 bg-gray-50/60 border-b border-gray-100">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              <div className="lg:col-span-2">
                                <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-2">
                                  Items
                                </p>
                                <div className="space-y-2">
                                  {sale.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-3 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <div className="min-w-0">
                                        <span className="font-medium text-gray-900">{item.productName}</span>
                                        {item.variant?.hasVariant && item.variant?.size && item.variant?.color && (
                                          <span className="text-brand-800 text-xs ml-1.5">
                                            ({item.variant.color} · {item.variant.size})
                                          </span>
                                        )}
                                        <span className="text-gray-400 text-xs ml-1.5">× {item.quantity}</span>
                                      </div>
                                      <span className="text-gray-900 font-medium whitespace-nowrap">{formatCurrency(item.total)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">Amount received</p>
                                  <p className="text-sm font-medium text-gray-900">{formatCurrency(sale.amountReceived)}</p>
                                </div>
                                {sale.balance > 0 && (
                                  <div>
                                    <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">Change given</p>
                                    <p className="text-sm font-medium text-gray-900">{formatCurrency(sale.balance)}</p>
                                  </div>
                                )}

                                <div className="pt-3 border-t border-gray-200">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); viewReceipt(sale); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium bg-brand-800 text-white hover:bg-brand-900 transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View receipt
                                  </button>
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
        </div>

        {/* Footer: results summary + pagination */}
        {sales.length > 0 && (
          <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-4">
              <p className="text-xs md:text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">
                  {pagination.total === 0 ? 0 : (pagination.current - 1) * pagination.limit + 1}
                  -{Math.min(pagination.current * pagination.limit, pagination.total)}
                </span> of <span className="font-semibold text-gray-900">{pagination.total}</span> transactions
                {searchTerm && <span className="text-brand-800"> matching &ldquo;{searchTerm}&rdquo; (this page)</span>}
              </p>

              <div className="flex items-center gap-2 md:gap-3 flex-nowrap">
                <CustomDropdown
                  options={PAGE_SIZE_OPTIONS.map(n => ({ value: String(n), label: `${n} per page` }))}
                  value={String(pageSize)}
                  onChange={(value) => setPageSize(Number(value))}
                  size="sm"
                  menuPlacement="top"
                  className="w-32 md:w-36 flex-shrink-0"
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={pagination.current <= 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs md:text-sm text-gray-600 px-1 whitespace-nowrap">
                    Page <span className="font-semibold text-gray-900">{pagination.current}</span> of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={pagination.current >= pagination.pages}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        sale={selectedSale}
      />
    </DashboardLayout>
  );
}
