"use client";
import { Calendar } from "lucide-react";

export default function InventoryBatchStatus({ 
  item, 
  currentBatch, 
  batchPricing, 
  onAddBatch,
  formatCurrency 
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Batch Status</h3>
      {currentBatch ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Active Batch</span>
            <span className="text-sm font-medium text-gray-900">{currentBatch.batchCode}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Batch Status</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              currentBatch.status === 'active' ? 'bg-green-100 text-green-700' :
              currentBatch.status === 'depleted' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {currentBatch.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current Cost Price</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(batchPricing.currentCostPrice)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current Selling Price</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(batchPricing.currentSellingPrice)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Received Date</span>
            <span className="text-sm font-medium text-gray-900">
              {new Date(currentBatch.dateReceived).toLocaleDateString()}
            </span>
          </div>
          {currentBatch.expiryDate && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Expires</span>
              <span className="text-sm font-medium text-gray-900">
                {new Date(currentBatch.expiryDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm">No active batches</p>
          <button 
            onClick={onAddBatch}
            className="mt-2 text-teal-600 text-sm hover:text-teal-700"
          >
            Add New Batch
          </button>
        </div>
      )}

      {/* Creation and Update Dates */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Created</span>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            {new Date(item.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Last Updated</span>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            {new Date(item.lastUpdated).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
