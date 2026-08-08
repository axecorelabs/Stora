"use client";
import { DollarSign } from "lucide-react";
import InventorySalesTable from "../InventorySalesTable";

export default function InventoryPricingAnalysis({ 
  item, 
  currentBatch, 
  batchPricing, 
  enhancedMetrics,
  formatCurrency 
}) {
  return (
    <div className="mt-8 bg-white rounded-2xl p-6 border border-gray-100 w-full">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <DollarSign className="w-5 h-5 mr-2 text-gray-600" />
        Batch-Based Pricing Analysis
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Batch Cost</label>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(batchPricing.currentCostPrice)}
          </div>
          <p className="text-xs text-gray-500">
            {currentBatch ? `Batch ${currentBatch.batchCode}` : 'No active batch'}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Batch Selling</label>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(batchPricing.currentSellingPrice)}
          </div>
          <p className="text-xs text-gray-500">Current batch price</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Average Cost (All Batches)</label>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(batchPricing.averageCostPrice)}
          </div>
          <p className="text-xs text-gray-500">Weighted average</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Average Selling (All Batches)</label>
          <div className="text-2xl font-bold text-teal-600">
            {formatCurrency(batchPricing.averageSellingPrice)}
          </div>
          <p className="text-xs text-gray-500">Weighted average</p>
        </div>
      </div>

      {/* Enhanced Investment vs Revenue using batch data */}
      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Financial Performance (Batch-Based)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-red-600">
              {formatCurrency(enhancedMetrics.totalInvestment)}
            </div>
            <div className="text-xs text-gray-500">Total Investment</div>
            <div className="text-xs text-gray-400">All batches</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">
              {formatCurrency(enhancedMetrics.totalRevenue)}
            </div>
            <div className="text-xs text-gray-500">Revenue Generated</div>
            <div className="text-xs text-gray-400">From sales</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(enhancedMetrics.totalProfit)}
            </div>
            <div className="text-xs text-gray-500">Total Profit</div>
            <div className="text-xs text-gray-400">Net profit</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-600">
              {enhancedMetrics.totalInvestment > 0 
                ? `${Math.round((enhancedMetrics.totalProfit / enhancedMetrics.totalInvestment) * 100)}%`
                : '0%'
              }
            </div>
            <div className="text-xs text-gray-500">ROI</div>
            <div className="text-xs text-gray-400">Return on investment</div>
          </div>
        </div>
      </div>

      {/* Sales History Table */}
      <InventorySalesTable item={item} />
    </div>
  );
}
