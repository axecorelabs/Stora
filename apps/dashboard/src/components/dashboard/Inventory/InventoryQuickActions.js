"use client";
import { Edit, Package, RefreshCw, Activity, BarChart3 } from "lucide-react";

export default function InventoryQuickActions({ 
  onEdit, 
  onAddBatch, 
  onUpdateStock, 
  onViewActivity,
  onViewAnalytics
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="space-y-3">
        <button
          onClick={onEdit}
          className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Edit className="w-5 h-5" />
          <span className="font-medium">Edit Item</span>
        </button>

        <button
          onClick={onAddBatch}
          className="w-full flex items-center space-x-3 px-4 py-3 text-teal-700 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors"
        >
          <Package className="w-5 h-5" />
          <span className="font-medium">New Batch</span>
        </button>

        <button
          onClick={onUpdateStock}
          className="w-full flex items-center space-x-3 px-4 py-3 text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          <span className="font-medium">Update Stock</span>
        </button>

        <button
          onClick={onViewActivity}
          className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Activity className="w-5 h-5" />
          <span className="font-medium">View Activity</span>
        </button>

        <button
          onClick={onViewAnalytics}
          className="w-full flex items-center space-x-3 px-4 py-3 text-purple-700 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
        >
          <BarChart3 className="w-5 h-5" />
          <span className="font-medium">View Analytics</span>
        </button>
      </div>
    </div>
  );
}
