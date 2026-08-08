"use client";
import { Edit, Delete, Package } from "lucide-react";

export default function InventoryProductOverview({ 
  item, 
  currentBatch, 
  activeBatches, 
  allBatches, 
  batchPricing, 
  onEdit 
}) {
  const getStatusColor = (item) => {
    if (!item) return 'bg-gray-100 text-gray-800';
    if (item.quantityInStock === 0) return 'bg-red-100 text-red-800';
    if (item.quantityInStock <= item.reorderLevel) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (item) => {
    if (!item) return 'Unknown';
    if (item.quantityInStock === 0) return 'Out of Stock';
    if (item.quantityInStock <= item.reorderLevel) return 'Low Stock';
    return 'In Stock';
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start space-x-4">
          {item.image ? (
            <img
              src={item.image}
              alt={item.productName}
              className="w-20 h-20 object-cover rounded-xl border border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{item.productName}</h1>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>SKU: {item.sku}</span>
              <span>•</span>
              <span>Category: {item.category}</span>
              {item.brand && (
                <>
                  <span>•</span>
                  <span>Brand: {item.brand}</span>
                </>
              )}
            </div>
            {currentBatch && (
              <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                <span>Current Batch: {currentBatch.batchCode}</span>
                <span>•</span>
                <span className={`px-2 py-1 rounded-full ${
                  currentBatch.status === 'active' ? 'bg-green-100 text-green-700' :
                  currentBatch.status === 'depleted' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {currentBatch.status}
                </span>
              </div>
            )}
            <div className="mt-2">
              <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(item)}`}>
                {getStatusText(item)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>

      {item.description && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
          <p className="text-gray-600">{item.description}</p>
        </div>
      )}

      {/* Enhanced Key Metrics using batch data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-xl">
          <div className="text-2xl font-bold text-gray-900">{item.quantityInStock}</div>
          <div className="text-xs text-gray-500 mt-1">Current Stock</div>
          {activeBatches.length > 0 && (
            <div className="text-xs text-blue-600 mt-1">
              {activeBatches.length} active batch{activeBatches.length !== 1 ? 'es' : ''}
            </div>
          )}
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-xl">
          <div className="text-2xl font-bold text-purple-600">
            {allBatches.reduce((sum, batch) => sum + batch.quantityIn, 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Stocked</div>
          <div className="text-xs text-gray-600 mt-1">{allBatches.length} total batches</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-xl">
          <div className="text-2xl font-bold text-blue-600">
            {allBatches.reduce((sum, batch) => sum + batch.quantitySold, 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Sold</div>
          <div className="text-xs text-gray-600 mt-1">Across all batches</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-xl">
          <div className="text-2xl font-bold text-green-600">{batchPricing.profitMargin}%</div>
          <div className="text-xs text-gray-500 mt-1">Current Margin</div>
          {currentBatch && (
            <div className="text-xs text-gray-600 mt-1">Batch {currentBatch.batchCode.split('-')[2]}</div>
          )}
        </div>
      </div>

      {/* Batch Status Overview */}
      {allBatches.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Batch Overview</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {allBatches.filter(b => b.status === 'active').length}
              </div>
              <div className="text-gray-600">Active Batches</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">
                {allBatches.filter(b => b.status === 'depleted').length}
              </div>
              <div className="text-gray-600">Depleted Batches</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-600">
                {activeBatches.reduce((sum, batch) => sum + batch.quantityRemaining, 0)}
              </div>
              <div className="text-gray-600">Units Remaining</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
