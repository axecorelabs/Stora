"use client";
import { useState, useEffect } from "react";
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
  Download,
  Filter,
  Search,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  MoreHorizontal
} from "lucide-react";

export default function SalesPage() {
  const { secureApiCall } = useAuth();
  const [sales, setSales] = useState([]);
  const [salesStats, setSalesStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
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
      
      if (filterBy === 'paymentMethod' && filterValue) {
        params.append('paymentMethod', filterValue);
      }
      if (filterBy === 'dateRange' && dateRange.startDate) {
        params.append('startDate', dateRange.startDate);
      }
      if (filterBy === 'dateRange' && dateRange.endDate) {
        params.append('endDate', dateRange.endDate);
      }

      const url = `/api/pos/sales${params.toString() ? '?' + params.toString() : ''}`;
      const response = await secureApiCall(url);
      
      if (response.success) {
        setSales(response.data.sales);
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
  }, [filterBy, filterValue, dateRange]);

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

  // Keep the printReceipt function for the table action button
  const printReceipt = (sale) => {
    // Set the sale and open modal, then print from within modal
    setSelectedSale(sale);
    setIsReceiptModalOpen(true);
  };

  // Sales stats cards
  const statsCards = salesStats ? [
    {
      title: 'Total Sales',
      value: salesStats.totalSales.toString(),
      icon: Receipt,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      description: 'All time sales count'
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(salesStats.totalRevenue),
      icon: DollarSign,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      description: 'All time revenue'
    },
    {
      title: 'Average Sale',
      value: formatCurrency(salesStats.avgSaleAmount),
      icon: TrendingUp,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      description: 'Average per transaction'
    },
    {
      title: "Today's Sales",
      value: salesStats.todaySales?.toString() || '0',
      icon: Calendar,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      description: 'Sales made today'
    }
  ] : [];

  if (loading) {
    return (
      <DashboardLayout title="Sales Management" subtitle="View and manage all sales transactions">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading sales data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Sales Management" subtitle="View and manage all sales transactions">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <div className={`p-2 ${stat.iconBg} rounded-xl mr-3`}>
                      <IconComponent className={`w-5 h-5 ${stat.iconColor}`} />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900">{stat.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{stat.description}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sales Overview */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Sales Transactions</h2>
            <div className="flex items-center space-x-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-80 bg-gray-50 border-0 rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm transition-all duration-200"
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
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
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

              {/* Export button */}
              <button className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-all duration-200">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Active Filters Display */}
          {((filterBy !== 'all' && filterValue) || (filterBy === 'dateRange' && (dateRange.startDate || dateRange.endDate))) && (
            <div className="mt-4 flex items-center space-x-2">
              <span className="text-sm text-gray-500">Active filters:</span>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                  {filterBy === 'paymentMethod' && `Payment: ${paymentMethodOptions.find(opt => opt.value === filterValue)?.label}`}
                  {filterBy === 'amount' && `Amount: ${amountRangeOptions.find(opt => opt.value === filterValue)?.label}`}
                  {filterBy === 'dateRange' && `Date: ${dateRange.startDate || 'Any'} to ${dateRange.endDate || 'Any'}`}
                  <button
                    onClick={() => {
                      setFilterValue('');
                      setDateRange({ startDate: '', endDate: '' });
                    }}
                    className="ml-2 text-teal-600 hover:text-teal-800"
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
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {getFilteredSales().length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
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
                getFilteredSales().map((sale) => (
                  <tr key={sale._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-gray-900">{sale.transactionId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{formatDate(sale.saleDate)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {sale.customer.name || 'Walk-in Customer'}
                        </div>
                        {sale.customer.phone && (
                          <div className="text-xs text-gray-500">{sale.customer.phone}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {sale.items.slice(0, 2).map((item, idx) => {
                          // Check if item has variant information
                          if (item.variant && item.variant.hasVariant && item.variant.size && item.variant.color) {
                            return (
                              <div key={idx} className="mb-1">
                                <span className="font-medium">{item.productName}</span>
                                <span className="text-teal-600 ml-1">
                                  ({item.variant.color} - {item.variant.size})
                                </span>
                              </div>
                            );
                          }
                          return <div key={idx} className="mb-1">{item.productName}</div>;
                        })}
                        {sale.items.length > 2 && (
                          <span className="text-gray-400"> +{sale.items.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="mr-2 text-gray-600">
                          {getPaymentMethodIcon(sale.paymentMethod)}
                        </div>
                        <span className="text-sm text-gray-900 capitalize">{sale.paymentMethod}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(sale.total)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                        sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                        sale.status === 'refunded' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => viewReceipt(sale)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                          title="View receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => printReceipt(sale)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                          title="Print receipt"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Results Summary */}
        {sales.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {getFilteredSales().length} of {sales.length} transactions
              {searchTerm && ` matching "${searchTerm}"`}
              {filterBy !== 'all' && ` with applied filters`}
            </p>
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
