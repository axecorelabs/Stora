"use client";
import { AlertTriangle } from "lucide-react";

export default function InventoryStockAlert({ item }) {
  if (item.quantityInStock > item.reorderLevel) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
      <div className="flex items-start">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
        <div>
          <h3 className="text-sm font-medium text-yellow-800 mb-1">
            {item.quantityInStock === 0 ? 'Out of Stock!' : 'Low Stock Alert!'}
          </h3>
          <p className="text-sm text-yellow-700">
            {item.quantityInStock === 0 
              ? 'This item is completely out of stock. Consider restocking immediately.'
              : `Only ${item.quantityInStock} ${(item.unitOfMeasure || 'units').toLowerCase()} left. Consider restocking soon.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}
