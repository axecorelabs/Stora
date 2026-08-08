"use client";
import { BarChart3, DollarSign, TrendingUp, Eye, Package } from "lucide-react";

export default function InventorySalesAnalytics({ 
  item, 
  enhancedMetrics, 
  batchPricing, 
  allBatches,
  formatCurrency 
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <BarChart3 className="w-5 h-5 mr-2 text-gray-600" />
        Batch-Based Sales & Revenue Analytics
        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
          Batch System
        </span>
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-700">Total Revenue</h3>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {formatCurrency(enhancedMetrics.totalRevenue)}
          </div>
          <p className="text-xs text-blue-600 mt-1">
            From {enhancedMetrics.totalSales} units sold
            {enhancedMetrics.salesCount > 0 && (
              <span className="block">Across {enhancedMetrics.salesCount} transactions</span>
            )}
          </p>
        </div>

        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-green-700">Total Profit</h3>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-900">
            {formatCurrency(enhancedMetrics.totalProfit)}
          </div>
          <p className="text-xs text-green-600 mt-1">
            Profit from all batches
            {enhancedMetrics.totalSales > 0 && (
              <span className="block">
                Avg: {formatCurrency(enhancedMetrics.totalProfit / enhancedMetrics.totalSales)} per unit
              </span>
            )}
          </p>
        </div>

        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-purple-700">Expected Revenue</h3>
            <Eye className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-900">
            {formatCurrency(item.quantityInStock * batchPricing.currentSellingPrice)}
          </div>
          <p className="text-xs text-purple-600 mt-1">
            Current stock at current batch price
            <span className="block">@ {formatCurrency(batchPricing.currentSellingPrice)} per unit</span>
          </p>
        </div>

        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-orange-700">ROI</h3>
            <Package className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-orange-900">
            {enhancedMetrics.totalInvestment > 0 
              ? Math.round((enhancedMetrics.totalProfit / enhancedMetrics.totalInvestment) * 100)
              : 0}%
          </div>
          <p className="text-xs text-orange-600 mt-1">
            Return on investment
            {enhancedMetrics.lastSaleDate && (
              <span className="block">
                Last sold: {new Date(enhancedMetrics.lastSaleDate).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Batch Performance Breakdown */}
      {enhancedMetrics.batchBreakdown && enhancedMetrics.batchBreakdown.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Batch Performance</h4>
          <div className="space-y-3">
            {enhancedMetrics.batchBreakdown.map((batch, index) => {
              // Safely extract values with defaults
              const quantitySold = Number(batch.quantitySold) || 0;
              const quantityIn = Number(batch.quantityIn) || 0;
              const revenue = Number(batch.revenue) || 0;
              const profit = Number(batch.profit) || 0;
              
              // Calculate percentage sold safely
              const percentageSold = quantityIn > 0 ? Math.round((quantitySold / quantityIn) * 100) : 0;
              
              // Get batch display info
              const batchDisplayCode = batch.batchCode || `Unknown-${index + 1}`;
              
              return (
                <div key={batch.batchCode || index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      batch.status === 'active' ? 'bg-green-100 text-green-700' :
                      batch.status === 'depleted' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {batchDisplayCode}
                    </span>
                    <div className="text-sm">
                      <span className="text-gray-600">
                        {quantitySold}/{quantityIn} sold
                      </span>
                      <span className="text-gray-400 ml-2">
                        ({percentageSold}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(revenue)}
                    </div>
                    <div className="text-green-600 text-xs">
                      +{formatCurrency(profit)} profit
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Enhanced Progress Bar for Stock Movement */}
      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Stock Movement</span>
          <span className="text-sm text-gray-600">
            {enhancedMetrics.totalSales} sold / {allBatches.reduce((sum, b) => sum + (Number(b.quantityIn) || 0), 0)} total stocked
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, enhancedMetrics.turnoverRate || 0))}%`
            }}
          ></div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div className="text-center">
            <div className="font-medium text-gray-900">{enhancedMetrics.totalSales || 0}</div>
            <div className="text-gray-500">Units Sold</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-gray-900">{item.quantityInStock || 0}</div>
            <div className="text-gray-500">In Stock</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-gray-900">
              {allBatches.reduce((sum, b) => sum + (Number(b.quantityIn) || 0), 0)}
            </div>
            <div className="text-gray-500">Total Stocked</div>
          </div>
        </div>
      </div>
    </div>
  );
}
