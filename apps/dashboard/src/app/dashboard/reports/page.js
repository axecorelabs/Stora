"use client";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ScheduleCard from "@/components/dashboard/ScheduleCard";
import { useAuth } from "@/contexts/AuthContext";
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Target,
  Users,
  Activity,
  Receipt,
  Package,
  AlertCircle,
  Store
} from "lucide-react";

export default function ReportsPage() {
  const { secureApiCall } = useAuth();
  const [inventoryStats, setInventoryStats] = useState(null);
  const [salesStats, setSalesStats] = useState(null);
  const [topItems, setTopItems] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [todayOrders, setTodayOrders] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState([]); // Add state for deliveries
  const [loading, setLoading] = useState(true);

  // Fetch all dashboard data
  const fetchReportsData = async () => {
    try {
      setLoading(true);
      
      // Fetch inventory statistics
      const statsResponse = await secureApiCall('/api/inventory/stats');
      if (statsResponse.success) {
        setInventoryStats(statsResponse.data.overview);
        setCategoryStats(statsResponse.data.categories);
      }

      // Fetch sales statistics
      const salesStatsResponse = await secureApiCall('/api/pos/sales/stats');
      if (salesStatsResponse.success) {
        setSalesStats(salesStatsResponse.data);
        setTodaySalesCount(salesStatsResponse.data.todaySales || 0);
      }

      // Fetch recent sales
      const salesResponse = await secureApiCall('/api/pos/sales?limit=5');
      if (salesResponse.success) {
        setRecentSales(salesResponse.data.sales);
      }

      // Fetch today's orders count
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayOrdersResponse = await secureApiCall(`/api/orders?createdFrom=${startOfDay}&limit=1`);
      if (todayOrdersResponse.success) {
        setTodayOrders(todayOrdersResponse.total || 0);
      }

      // Fetch upcoming deliveries
      const deliveriesResponse = await secureApiCall('/api/deliveries');
      if (deliveriesResponse.success) {
        setUpcomingDeliveries(deliveriesResponse.data || []);
      }

      // Fetch top items
      const inventoryResponse = await secureApiCall('/api/inventory?limit=10&sortBy=quantityInStock&sortOrder=-1');
      if (inventoryResponse.success) {
        setTopItems(inventoryResponse.data.slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

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

  // Chart data
  const chartData = [
    { month: 'Feb', inventory: 30, sales: 25 },
    { month: 'Mar', inventory: 45, sales: 35 },
    { month: 'Apr', inventory: 55, sales: 45 },
    { month: 'May', inventory: 35, sales: 40 },
    { month: 'Jun', inventory: 15, sales: 30 },
    { month: 'Jul', inventory: 95, sales: 60 },
    { month: 'Aug', inventory: 40, sales: 70 },
    { month: 'Sep', inventory: 35, sales: 55 },
    { month: 'Oct', inventory: 60, sales: 50 },
    { month: 'Nov', inventory: 45, sales: 65 },
    { month: 'Dec', inventory: 75, sales: 80 }
  ];

  if (loading) {
    return (
      <DashboardLayout title="Reports & Analysis" subtitle="Comprehensive business insights">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading reports data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const revenueGrowth = getRevenueGrowth();

  return (
    <DashboardLayout title="Reports & Analysis" subtitle="Comprehensive business insights">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Stats Cards */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Revenue */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
              <DollarSign className="w-4 h-4 text-gray-400" />
            </div>
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">
                {salesStats ? formatCurrency(salesStats.totalRevenue) : formatCurrency(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                From <span className="font-medium">{salesStats?.totalSales || 0} sales</span>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {revenueGrowth > 0 ? (
                <ArrowUpRight className="w-3 h-3 text-green-600" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-red-600" />
              )}
              <span className={`text-xs font-medium ${revenueGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(revenueGrowth)}%
              </span>
              <span className="text-xs text-gray-500">vs last week</span>
            </div>
          </div>

          {/* Today's Sales - Fixed to show actual today's sales */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Total Sales</h3>
              <Receipt className="w-4 h-4 text-gray-400" />
            </div>
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">{todaySalesCount}</p>
              <p className="text-xs text-gray-500 mt-1">
                Revenue: <span className="font-medium">{salesStats ? formatCurrency(salesStats.todayRevenue || 0) : formatCurrency(0)}</span>
              </p>
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-full font-medium">
                View Sales
              </button>
            </div>
          </div>

          {/* Inventory Value */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Inventory Value</h3>
              <Package className="w-4 h-4 text-gray-400" />
            </div>
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">
                {inventoryStats ? formatCurrency(inventoryStats.totalStockValue) : formatCurrency(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Stock: <span className="font-medium">{inventoryStats?.totalItems || 0} items</span>
              </p>
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-full font-medium">
                Manage
              </button>
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Stock Alerts</h3>
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">{inventoryStats?.lowStockItems || 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                Out of stock: <span className="font-medium text-red-600">{inventoryStats?.outOfStockItems || 0} items</span>
              </p>
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-1.5 bg-yellow-500 text-white text-xs rounded-full font-medium">
                Restock
              </button>
            </div>
          </div>

          {/* Today's Orders - Fixed */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Today's Orders</h3>
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">{todayOrders}</p>
              <p className="text-xs text-gray-500 mt-1">
                Alerts: <span className="font-medium text-red-600">{inventoryStats?.lowStockItems || 0} low stock</span>
              </p>
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-1.5 bg-orange-500 text-white text-xs rounded-full font-medium">
                View Orders
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Card with actual delivery data */}
        <ScheduleCard deliveries={upcomingDeliveries} />

        {/* Sales & Inventory Trends */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Sales & Inventory Trends</h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gray-900 rounded-full"></div>
                    <span className="text-sm text-gray-600">Sales</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-teal-600 rounded-full"></div>
                    <span className="text-sm text-gray-600">Inventory</span>
                  </div>
                </div>
                <button className="text-sm text-gray-500">Monthly</button>
              </div>
            </div>
            
            {/* Chart */}
            <div className="h-64 flex items-end space-x-2">
              {chartData.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex space-x-1 items-end" style={{ height: '200px' }}>
                    <div 
                      className="flex-1 bg-gray-900 rounded-t"
                      style={{ height: `${(item.sales / 100) * 200}px` }}
                      title={`Sales: ${item.sales}%`}
                    ></div>
                    <div 
                      className="flex-1 bg-teal-600 rounded-t"
                      style={{ height: `${(item.inventory / 100) * 200}px` }}
                      title={`Inventory: ${item.inventory}%`}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500 mt-2">{item.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Sales */}
        <div className="lg:col-span-4 h-full">
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Recent Sales</h3>
              <button className="text-sm text-teal-600 hover:text-teal-700">View All</button>
            </div>
            
            <div className="space-y-4">
              {recentSales.length > 0 ? recentSales.map((sale, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">#{sale.transactionId}</p>
                      <p className="text-xs text-gray-500">{formatDate(sale.saleDate)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(sale.total)}</p>
                    <p className="text-xs text-gray-500">{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No sales yet</p>
                  <p className="text-gray-400 text-xs">Sales will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sales Performance */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Sales Performance</h3>
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </div>
            
            {salesStats ? (
              <>
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-1">Average Sale Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(salesStats.avgSaleAmount)}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Today vs Week Average</span>
                      <span className="text-sm text-gray-900 font-medium">
                        {salesStats.weekSales > 0 
                          ? Math.round((salesStats.todaySales / (salesStats.weekSales / 7)) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-teal-600 h-2 rounded-full" 
                          style={{
                            width: salesStats.weekSales > 0 
                              ? `${Math.min(100, (salesStats.todaySales / (salesStats.weekSales / 7)) * 100)}%`
                              : '0%'
                          }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {salesStats.todaySales}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">This Week</span>
                      <span className="text-sm text-gray-900 font-medium">
                        {formatCurrency(salesStats.weekRevenue)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{
                            width: salesStats.monthRevenue > 0 
                              ? `${Math.min(100, (salesStats.weekRevenue / salesStats.monthRevenue) * 100)}%`
                              : '0%'
                          }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {salesStats.weekSales}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">This Month</span>
                      <span className="text-sm text-gray-900 font-medium">
                        {formatCurrency(salesStats.monthRevenue)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full w-full"></div>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{salesStats.monthSales}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No sales data</p>
                <p className="text-gray-400 text-xs">Make your first sale to see performance</p>
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Category Breakdown</h3>
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </div>
            
            {categoryStats.length > 0 ? (
              <>
                <div className="flex space-x-2 mb-6 flex-wrap">
                  {categoryStats.slice(0, 3).map((category, index) => (
                    <button 
                      key={index}
                      className={`px-3 py-1.5 text-xs rounded-full font-medium ${
                        index === 0 
                          ? 'bg-gray-900 text-white' 
                          : 'border border-gray-300 text-gray-700'
                      }`}
                    >
                      {category._id}
                    </button>
                  ))}
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">{categoryStats[0]?._id || 'No categories'}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {categoryStats[0] ? formatCurrency(categoryStats[0].totalValue) : formatCurrency(0)}
                  </p>
                </div>

                <div className="flex items-end space-x-1 h-20 mb-4">
                  {categoryStats.slice(0, 5).map((category, index) => {
                    const maxValue = Math.max(...categoryStats.slice(0, 5).map(c => c.totalValue));
                    const height = maxValue > 0 ? (category.totalValue / maxValue) * 100 : 0;
                    return (
                      <div 
                        key={index}
                        className={`w-4 rounded-t ${index === 0 ? 'bg-gray-900' : 'bg-gray-200'}`}
                        style={{ height: `${height}%` }}
                        title={`${category._id}: ${formatCurrency(category.totalValue)}`}
                      ></div>
                    );
                  })}
                </div>

                <p className="text-sm text-gray-500">
                  Average: <span className="font-medium text-gray-900">
                    {categoryStats.length > 0 
                      ? formatCurrency(categoryStats.reduce((sum, cat) => sum + cat.totalValue, 0) / categoryStats.length)
                      : formatCurrency(0)
                    }
                  </span>
                </p>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No categories yet</p>
                <p className="text-gray-400 text-xs">Add inventory items to see breakdown</p>
              </div>
            )}
          </div>
        </div>

        {/* Stock Status */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Stock Status</h3>
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </div>
            
            {inventoryStats ? (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Adequate Stock</span>
                    <span className="text-sm text-gray-900 font-medium">
                      ({inventoryStats.totalItems > 0 
                        ? Math.round(((inventoryStats.totalItems - inventoryStats.lowStockItems - inventoryStats.outOfStockItems) / inventoryStats.totalItems) * 100)
                        : 0}%)
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-teal-600 h-2 rounded-full" 
                        style={{
                          width: inventoryStats.totalItems > 0 
                            ? `${((inventoryStats.totalItems - inventoryStats.lowStockItems - inventoryStats.outOfStockItems) / inventoryStats.totalItems) * 100}%`
                            : '0%'
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {inventoryStats.totalItems - inventoryStats.lowStockItems - inventoryStats.outOfStockItems}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Low Stock</span>
                    <span className="text-sm text-gray-900 font-medium">
                      ({inventoryStats.totalItems > 0 
                        ? Math.round((inventoryStats.lowStockItems / inventoryStats.totalItems) * 100)
                        : 0}%)
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full" 
                        style={{
                          width: inventoryStats.totalItems > 0 
                            ? `${(inventoryStats.lowStockItems / inventoryStats.totalItems) * 100}%`
                            : '0%'
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{inventoryStats.lowStockItems}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Out of Stock</span>
                    <span className="text-sm text-gray-900 font-medium">
                      ({inventoryStats.totalItems > 0 
                        ? Math.round((inventoryStats.outOfStockItems / inventoryStats.totalItems) * 100)
                        : 0}%)
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{
                          width: inventoryStats.totalItems > 0 
                            ? `${(inventoryStats.outOfStockItems / inventoryStats.totalItems) * 100}%`
                            : '0%'
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{inventoryStats.outOfStockItems}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No inventory data</p>
                <p className="text-gray-400 text-xs">Add items to see stock status</p>
              </div>
            )}
          </div>
        </div>

        {/* CTA Card */}
        <div className="lg:col-span-6">
          <div className="bg-gradient-to-r from-gray-900 to-teal-900 rounded-2xl p-8 text-white relative overflow-hidden h-full">
            <div className="flex flex-col justify-between h-full">
              <div>
                <p className="text-sm text-gray-300 mb-2">Business Intelligence</p>
                <h3 className="text-2xl font-bold mb-4">
                  {salesStats?.totalSales > 0 
                    ? 'Data-driven insights at your fingertips' 
                    : 'Ready to analyze your business?'
                  }
                </h3>
                <button className="bg-white text-gray-900 px-6 py-3 rounded-xl font-medium hover:bg-gray-100 transition-colors">
                  {salesStats?.totalSales > 0 ? 'Export Reports' : 'Get Started'}
                </button>
              </div>
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-600">
                <div className="text-center">
                  <p className="text-2xl font-bold">{salesStats?.totalSales || 0}</p>
                  <p className="text-xs text-gray-300">Total Sales</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{inventoryStats?.totalItems || 0}</p>
                  <p className="text-xs text-gray-300">Products</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {salesStats ? formatCurrency(salesStats.totalRevenue).replace('₦', '₦') : '₦0'}
                  </p>
                  <p className="text-xs text-gray-300">Revenue</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
