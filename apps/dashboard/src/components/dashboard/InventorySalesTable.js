"use client";
import { useState, useEffect } from "react";
import { Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CustomDropdown from "../ui/CustomDropdown";

export default function InventorySalesTable({ item }) {
  const { secureApiCall } = useAuth();
  const [salesData, setSalesData] = useState([]);
  const [batches, setBatches] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('');
  const [salesPage, setSalesPage] = useState(1);
  const [totalSalesPages, setTotalSalesPages] = useState(1);
  const salesPerPage = 25;

  // Fetch item sales with batch details
  const fetchItemSales = async (page = 1, batchFilter = '') => {
    try {
      setSalesLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: salesPerPage.toString(),
        inventoryId: item._id // Filter sales by inventory item
      });
      
      if (batchFilter) {
        params.append('batchId', batchFilter);
      }

      const response = await secureApiCall(`/api/pos/sales?${params.toString()}`);
      if (response.success) {
        // Filter sales to only include those with the current item
        const filteredSales = response.data.sales.filter(sale => 
          sale.items && sale.items.some(saleItem => 
            saleItem.inventoryId === item._id
          )
        );
        
        setSalesData(filteredSales);
        setTotalSalesPages(Math.ceil(filteredSales.length / salesPerPage));
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
      setSalesData([]);
    } finally {
      setSalesLoading(false);
    }
  };

  // Fetch batches for filtering
  const fetchBatches = async () => {
    try {
      const response = await secureApiCall(`/api/inventory/${item._id}/batches`);
      if (response.success) {
        setBatches(response.data.batches);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      setBatches([]);
    }
  };

  useEffect(() => {
    if (item?._id) {
      fetchItemSales(1, selectedBatchFilter);
      fetchBatches();
    }
  }, [item?._id, selectedBatchFilter]);

  // Handle batch filter change
  const handleBatchFilterChange = (batchId) => {
    setSelectedBatchFilter(batchId);
    setSalesPage(1);
    fetchItemSales(1, batchId);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setSalesPage(newPage);
    fetchItemSales(newPage, selectedBatchFilter);
  };

  // Get batch options for filter
  const getBatchFilterOptions = () => {
    const options = [{ value: '', label: 'All Batches' }];
    
    const sortedBatches = [...batches].sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));
    
    sortedBatches.forEach((batch, index) => {
      const batchNumber = index + 1;
      options.push({
        value: batch._id,
        label: `Batch ${batchNumber} - ${batch.batchCode}`
      });
    });
    
    return options;
  };

  // Get batch analytics for the filtered batch
  const getBatchAnalytics = () => {
    if (!selectedBatchFilter || !salesData.length) return null;
    
    let totalQuantity = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let transactions = 0;
    
    salesData.forEach(sale => {
      const itemInSale = sale.items?.find(saleItem => saleItem.inventoryId === item._id);
      if (itemInSale && itemInSale.batchesSoldFrom) {
        const batchData = itemInSale.batchesSoldFrom.find(batch => batch.batchId === selectedBatchFilter);
        if (batchData) {
          totalQuantity += batchData.quantityFromBatch || 0;
          totalRevenue += (batchData.quantityFromBatch || 0) * itemInSale.unitPrice;
          totalCost += (batchData.quantityFromBatch || 0) * (batchData.costPriceFromBatch || 0);
          transactions += 1;
        }
      }
    });
    
    const totalProfit = totalRevenue - totalCost;
    const selectedBatch = batches.find(b => b._id === selectedBatchFilter);
    
    return {
      totalQuantity,
      totalRevenue,
      totalCost,
      totalProfit,
      averagePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0,
      batchCode: selectedBatch?.batchCode || '',
      transactions
    };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!item) return null;

  return (
    <div className="mt-8 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Sales History</h3>
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-700">Filter by Batch:</label>
          <CustomDropdown
            options={getBatchFilterOptions()}
            value={selectedBatchFilter}
            onChange={handleBatchFilterChange}
            placeholder="All Batches"
            className="w-48"
          />
        </div>
      </div>

      {/* Batch Analytics Summary */}
      {selectedBatchFilter && getBatchAnalytics() && (
        <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-3">
            Batch Analytics: {getBatchAnalytics().batchCode}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-blue-900">{getBatchAnalytics().totalQuantity}</div>
              <div className="text-xs text-blue-700">Units Sold</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-700">
                {formatCurrency(getBatchAnalytics().totalRevenue)}
              </div>
              <div className="text-xs text-blue-700">Revenue</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-700">
                {formatCurrency(getBatchAnalytics().totalProfit)}
              </div>
              <div className="text-xs text-blue-700">Profit</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-700">
                {formatCurrency(getBatchAnalytics().averagePrice)}
              </div>
              <div className="text-xs text-blue-700">Avg Price</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-700">{getBatchAnalytics().transactions}</div>
              <div className="text-xs text-blue-700">Transactions</div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Table */}
      {salesLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : salesData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch(es)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {salesData.map((sale) => {
                // Find the specific item in this sale
                const itemInSale = sale.items?.find(saleItem => saleItem.inventoryId === item._id);
                if (!itemInSale) return null;

                const saleBatches = itemInSale.batchesSoldFrom || [];
                
                const filteredBatches = selectedBatchFilter 
                  ? saleBatches.filter(batch => batch.batchId === selectedBatchFilter)
                  : saleBatches;
                
                const saleQuantity = selectedBatchFilter
                  ? filteredBatches.reduce((sum, batch) => sum + (batch.quantityFromBatch || 0), 0)
                  : itemInSale.quantity;
                
                const saleRevenue = saleQuantity * itemInSale.unitPrice;
                const saleCost = filteredBatches.reduce((sum, batch) => 
                  sum + ((batch.quantityFromBatch || 0) * (batch.costPriceFromBatch || 0)), 0
                );
                const saleProfit = saleRevenue - saleCost;

                // Skip if filtered batch doesn't exist in this sale
                if (selectedBatchFilter && filteredBatches.length === 0) return null;

                return (
                  <tr key={sale._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(sale.saleDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                      {sale.transactionId || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="space-y-1">
                        {filteredBatches.length > 0 ? filteredBatches.map((batch, index) => {
                          const batchIndex = batches
                            .sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived))
                            .findIndex(b => b._id === batch.batchId);
                          
                          return (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">
                                {batchIndex >= 0 ? `Batch ${batchIndex + 1}` : 'Unknown Batch'} ({batch.batchCode || 'N/A'})
                              </span>
                              <span className="text-xs font-medium text-gray-900">
                                {batch.quantityFromBatch || 0} {item.unitOfMeasure.toLowerCase()}
                              </span>
                            </div>
                          );
                        }) : (
                          <div className="text-xs text-gray-500">
                            No batch data available
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {saleQuantity} {item.unitOfMeasure.toLowerCase()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(itemInSale.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600">
                      {formatCurrency(saleRevenue)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <span className={saleProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(saleProfit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {sale.customer?.name || 'Walk-in'}
                      {sale.customer?.phone && (
                        <div className="text-xs text-gray-500">{sale.customer.phone}</div>
                      )}
                    </td>
                  </tr>
                );
              }).filter(Boolean)}
            </tbody>
          </table>

          {/* Pagination */}
          {totalSalesPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-700">
                Showing page {salesPage} of {totalSalesPages}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(salesPage - 1)}
                  disabled={salesPage === 1}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalSalesPages) }, (_, i) => {
                    let pageNum;
                    if (totalSalesPages <= 5) {
                      pageNum = i + 1;
                    } else if (salesPage <= 3) {
                      pageNum = i + 1;
                    } else if (salesPage >= totalSalesPages - 2) {
                      pageNum = totalSalesPages - 4 + i;
                    } else {
                      pageNum = salesPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 text-sm rounded-md ${
                          salesPage === pageNum
                            ? 'bg-teal-600 text-white'
                            : 'bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(salesPage + 1)}
                  disabled={salesPage === totalSalesPages}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 border border-gray-200 rounded-lg">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {selectedBatchFilter ? 'No sales found for this batch' : 'No sales recorded for this item yet'}
          </p>
          <p className="text-gray-400 text-sm">
            {selectedBatchFilter ? 'Try selecting a different batch or clear the filter' : 'Sales will appear here once transactions are made'}
          </p>
        </div>
      )}
    </div>
  );
}
