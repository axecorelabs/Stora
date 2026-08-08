"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  Calendar,
  Filter,
  Download,
  ArrowLeft
} from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";

// Separate component that uses useSearchParams
function AnalyticsContent() {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemIdFromUrl = searchParams.get('item');

  const [loading, setLoading] = useState(true);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemBatches, setItemBatches] = useState([]);
  const [batchSalesData, setBatchSalesData] = useState([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      fetchItemBatches(selectedItem._id);
      fetchBatchSalesData(selectedItem._id);
    }
  }, [selectedItem]);

  // Auto-select item from URL parameter
  useEffect(() => {
    if (itemIdFromUrl && inventoryItems.length > 0) {
      const item = inventoryItems.find(i => i._id === itemIdFromUrl);
      if (item) {
        setSelectedItem(item);
      }
    }
  }, [itemIdFromUrl, inventoryItems]);

  const fetchInventoryItems = async () => {
    try {
      const response = await secureApiCall('/api/inventory');
      if (response.success) {
        setInventoryItems(response.data);
        
        // If no URL param, select first item by default
        if (!itemIdFromUrl && response.data.length > 0) {
          setSelectedItem(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItemBatches = async (itemId) => {
    try {
      const response = await secureApiCall(`/api/inventory/${itemId}/batches`);
      if (response.success) {
        setItemBatches(response.data.batches);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    }
  };

  const fetchBatchSalesData = async (itemId) => {
    try {
      const response = await secureApiCall(`/api/inventory/${itemId}/batch-sales-analytics`);
      if (response.success) {
        setBatchSalesData(response.data);
      }
    } catch (error) {
      console.error('Error fetching batch sales:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getCurrentBatch = () => {
    const activeBatches = itemBatches.filter(b => b.status === 'active');
    if (activeBatches.length > 0) {
      return activeBatches.sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived))[0];
    }
    return itemBatches.length > 0 ? itemBatches[0] : null;
  };

  const calculateAnalytics = () => {
    if (!selectedItem || itemBatches.length === 0) {
      return {
        totalRevenue: 0,
        totalProfit: 0,
        totalInvestment: 0,
        unitsSold: 0,
        inStock: 0,
        totalStocked: 0,
        roi: 0,
        expectedRevenue: 0,
        averageCostPrice: 0,
        averageSellingPrice: 0
      };
    }

    const currentBatch = getCurrentBatch();
    const totalInvestment = itemBatches.reduce((sum, b) => sum + (b.quantityIn * b.costPrice), 0);
    const totalRevenue = itemBatches.reduce((sum, b) => sum + (b.quantitySold * b.sellingPrice), 0);
    const totalProfit = itemBatches.reduce((sum, b) => 
      sum + (b.quantitySold * (b.sellingPrice - b.costPrice)), 0
    );
    const unitsSold = itemBatches.reduce((sum, b) => sum + b.quantitySold, 0);
    const totalStocked = itemBatches.reduce((sum, b) => sum + b.quantityIn, 0);
    const expectedRevenue = currentBatch 
      ? selectedItem.quantityInStock * currentBatch.sellingPrice 
      : 0;
    const roi = totalInvestment > 0 ? ((totalProfit / totalInvestment) * 100) : 0;

    // Calculate weighted averages
    const totalQuantityIn = itemBatches.reduce((sum, b) => sum + b.quantityIn, 0);
    const weightedCostSum = itemBatches.reduce((sum, b) => sum + (b.costPrice * b.quantityIn), 0);
    const weightedSellingSum = itemBatches.reduce((sum, b) => sum + (b.sellingPrice * b.quantityIn), 0);
    
    const averageCostPrice = totalQuantityIn > 0 ? weightedCostSum / totalQuantityIn : 0;
    const averageSellingPrice = totalQuantityIn > 0 ? weightedSellingSum / totalQuantityIn : 0;

    return {
      totalRevenue,
      totalProfit,
      totalInvestment,
      unitsSold,
      inStock: selectedItem.quantityInStock,
      totalStocked,
      roi,
      expectedRevenue,
      currentBatch,
      averageCostPrice,
      averageSellingPrice
    };
  };

  const analytics = calculateAnalytics();

  if (loading) {
    return (
      <DashboardLayout title="Analytics" subtitle="Inventory Performance Analysis">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Analytics" subtitle="Inventory Performance Analysis">
      {/* Back Button & Item Selector */}
      <div className="mb-6 bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="flex-1 mx-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Product to Analyze
            </label>
            <CustomDropdown
              options={inventoryItems.map(item => ({
                value: item._id,
                label: `${item.productName} (${item.sku})`
              }))}
              value={selectedItem?._id}
              onChange={(value) => {
                const item = inventoryItems.find(i => i._id === value);
                setSelectedItem(item);
                // Update URL
                router.push(`/dashboard/analytics?item=${value}`);
              }}
              placeholder="Select a product"
            />
          </div>

          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
              <Calendar className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Date Range</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Export</span>
            </button>
          </div>
        </div>
      </div>

      {!selectedItem ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Select a product to view analytics</p>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 rounded-xl">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Total Revenue</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">From {analytics.unitsSold} units sold</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Total Profit</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalProfit)}</p>
              <p className="text-xs text-gray-500 mt-1">Profit from all batches</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Expected Revenue</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.expectedRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Current stock at {analytics.currentBatch ? formatCurrency(analytics.currentBatch.sellingPrice) : '₦0'} per unit
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                {analytics.roi > 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                )}
              </div>
              <h3 className="text-sm text-gray-600 mb-1">ROI</h3>
              <p className="text-2xl font-bold text-gray-900">{analytics.roi.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">Return on investment</p>
            </div>
          </div>

          {/* Batch Performance & Stock Movement */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Batch Performance */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Batch Performance</h3>
              </div>
              <div className="p-6">
                {itemBatches.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No batches found for this product</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {itemBatches.map((batch) => {
                      const soldPercentage = batch.quantityIn > 0 
                        ? (batch.quantitySold / batch.quantityIn) * 100 
                        : 0;
                      const revenue = batch.quantitySold * batch.sellingPrice;
                      const profit = batch.quantitySold * (batch.sellingPrice - batch.costPrice);

                      return (
                        <div key={batch._id} className="p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900">{batch.batchCode}</h4>
                              <p className="text-sm text-gray-600">
                                {batch.quantitySold}/{batch.quantityIn} sold ({soldPercentage.toFixed(1)}%)
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              batch.status === 'active' 
                                ? 'bg-green-100 text-green-700'
                                : batch.status === 'depleted'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {batch.status}
                            </span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${soldPercentage}%` }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Revenue</p>
                              <p className="font-semibold text-gray-900">{formatCurrency(revenue)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Profit</p>
                              <p className="font-semibold text-green-600">+{formatCurrency(profit)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Stock Movement */}
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Stock Movement</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {analytics.unitsSold} sold / {analytics.totalStocked} total stocked
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Units Sold</span>
                      <span className="text-lg font-bold text-gray-900">{analytics.unitsSold}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full"
                        style={{ 
                          width: `${analytics.totalStocked > 0 ? (analytics.unitsSold / analytics.totalStocked) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">In Stock</span>
                      <span className="text-lg font-bold text-gray-900">{analytics.inStock}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ 
                          width: `${analytics.totalStocked > 0 ? (analytics.inStock / analytics.totalStocked) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Stocked</span>
                      <span className="text-xl font-bold text-gray-900">{analytics.totalStocked}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Performance & Pricing Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Financial Performance</h3>
                <p className="text-sm text-gray-500 mt-1">Batch-based calculations</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Investment</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalInvestment)}</p>
                    <p className="text-xs text-gray-500 mt-1">All batches</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Revenue Generated</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(analytics.totalRevenue)}</p>
                    <p className="text-xs text-gray-500 mt-1">From sales</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Profit</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(analytics.totalProfit)}</p>
                    <p className="text-xs text-gray-500 mt-1">Net profit</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">ROI</p>
                    <p className="text-2xl font-bold text-purple-600">{analytics.roi.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-1">Return on investment</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Pricing Analysis</h3>
                <p className="text-sm text-gray-500 mt-1">Batch-based pricing</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {analytics.currentBatch && (
                    <>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm text-gray-600">Current Batch Cost</p>
                          <p className="text-xs text-gray-500 mt-1">Batch {analytics.currentBatch.batchCode}</p>
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(analytics.currentBatch.costPrice)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm text-gray-600">Current Batch Selling</p>
                          <p className="text-xs text-gray-500 mt-1">Current batch price</p>
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(analytics.currentBatch.sellingPrice)}
                        </p>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                    <div>
                      <p className="text-sm text-teal-900">Average Cost (All Batches)</p>
                      <p className="text-xs text-teal-700 mt-1">Weighted average</p>
                    </div>
                    <p className="text-lg font-bold text-teal-900">
                      {formatCurrency(analytics.averageCostPrice)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                    <div>
                      <p className="text-sm text-teal-900">Average Selling (All Batches)</p>
                      <p className="text-xs text-teal-700 mt-1">Weighted average</p>
                    </div>
                    <p className="text-lg font-bold text-teal-900">
                      {formatCurrency(analytics.averageSellingPrice)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sales History */}
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Sales History</h3>
                <div className="w-64">
                  <CustomDropdown
                    options={[
                      { value: 'all', label: 'All Batches' },
                      ...itemBatches.map(b => ({
                        value: b.batchCode,
                        label: b.batchCode
                      }))
                    ]}
                    value={selectedBatchFilter}
                    onChange={setSelectedBatchFilter}
                    placeholder="Filter by Batch"
                  />
                </div>
              </div>
            </div>
            <div className="p-6">
              {batchSalesData.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg font-medium mb-2">No sales recorded for this item yet</p>
                  <p className="text-gray-500 text-sm">Sales will appear here once transactions are made</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {batchSalesData
                        .filter(sale => selectedBatchFilter === 'all' || sale.batchCode === selectedBatchFilter)
                        .map((sale, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {sale.lastSaleDate ? new Date(sale.lastSaleDate).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">{sale.batchCode}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{sale.totalQuantitySold || 0}</td>
                            <td className="px-6 py-4 text-sm font-medium text-green-600">
                              {formatCurrency(sale.totalRevenue || 0)}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-blue-600">
                              {formatCurrency(sale.totalProfit || 0)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

// Main component with Suspense wrapper
export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout title="Analytics" subtitle="Inventory Performance Analysis">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
