"use client";
import { useState } from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";

export default function DeleteConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  item,
  isDeleting = false 
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const quickReasons = [
    'No longer selling this product',
    'Product discontinued',
    'Out of stock permanently',
    'Replaced by newer version',
    'Low demand',
    'Seasonal item - season ended',
    'Duplicate entry',
    'Supplier stopped production'
  ];

  if (!isOpen || !item) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for deletion');
      return;
    }

    try {
      await onConfirm(reason.trim());
      setReason('');
      setError('');
      onClose();
    } catch (error) {
      setError(error.message || 'Failed to delete item');
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setReason('');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Delete Item</h2>
              <p className="text-sm text-gray-500">This action will archive the item</p>
            </div>
          </div>
          {!isDeleting && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">What happens when you delete?</p>
                <ul className="text-sm text-amber-800 mt-2 space-y-1">
                  <li>• Item will be archived (not permanently deleted)</li>
                  <li>• All sales history will be preserved</li>
                  <li>• Related batches will be archived</li>
                  <li>• Item can be restored within 30 days</li>
                  <li>• After 30 days, item may be permanently deleted</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Item Details */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-2">Item to be deleted:</p>
            <div className="space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Product:</span> {item.productName}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">SKU:</span> {item.sku}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Category:</span> {item.category}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Stock:</span> {item.quantityInStock} {item.unitOfMeasure}
              </p>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for deletion *
            </label>
            
            {/* Quick Reason Pills */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">Quick select:</p>
              <div className="flex flex-wrap gap-2">
                {quickReasons.map((quickReason, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setReason(quickReason);
                      setError('');
                    }}
                    disabled={isDeleting}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      reason === quickReason
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {quickReason}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              rows={3}
              placeholder="e.g., No longer selling this product, Discontinued item, etc."
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent text-black resize-none ${
                error ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={isDeleting}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Item</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
