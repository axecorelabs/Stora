"use client";
import { useState, useEffect } from "react";
import { X, Plus, Minus, Package, TrendingUp, TrendingDown, Calendar, AlertTriangle } from "lucide-react";
import CustomDropdown from "../ui/CustomDropdown";
import { useAuth } from "@/contexts/AuthContext";

export default function StockUpdateModal({ isOpen, onClose, onSubmit, item }) {
  const { secureApiCall } = useAuth();
  const [updateType, setUpdateType] = useState('add');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [activeBatches, setActiveBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // A product with more than one variant needs its batches scoped to
  // whichever one is selected -- otherwise every variant's batches come
  // back mixed together with no way to tell them apart (each batch
  // belongs to exactly one variant). A simple, single-variant product
  // (the overwhelming majority) has nothing to scope by, so variantId
  // stays unset for it, same request shape as before this existed.
  const fetchActiveBatches = async (variantId) => {
    if (!item?._id) return;

    setLoading(true);
    try {
      const query = variantId ? `&variantId=${variantId}` : '';
      const response = await secureApiCall(`/api/inventory/${item._id}/batches?status=active${query}`);
      if (response.success) {
        setActiveBatches(response.data.batches);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  // Variant dropdown options -- only ever rendered when there's more
  // than one, see the JSX below. Mirrors AddBatchModal.js's own
  // color/size variant shape (item.variants[], already populated by
  // every caller of this modal -- no new prop plumbing needed).
  const getVariantOptions = () => {
    return (item?.variants || [])
      .filter((v) => v.isActive !== false)
      .map((v) => ({
        value: v._id,
        label: `${v.color || 'Default'} - ${v.size || 'One Size'} (${v.quantityInStock ?? 0} in stock)`
      }));
  };

  const getSelectedVariant = () => {
    if (!item?.variants) return null;
    return item.variants.find((v) => v._id === selectedVariantId) || null;
  };

  const handleVariantChange = (value) => {
    setSelectedVariantId(value);
    // A batch selected under the previous variant is meaningless here --
    // batches don't span variants.
    setSelectedBatch('');
    if (errors.variant) {
      setErrors((prev) => ({ ...prev, variant: '' }));
    }
    fetchActiveBatches(value);
  };

  const addReasonOptions = [
    { value: '', label: 'Select a reason' },
    { value: 'New delivery', label: 'New delivery' },
    { value: 'Stock return', label: 'Stock return' },
    { value: 'Found extra stock', label: 'Found extra stock' },
    { value: 'Stock correction', label: 'Stock correction' },
    { value: 'Batch adjustment', label: 'Batch adjustment' },
    { value: 'Other', label: 'Other' }
  ];

  const subtractReasonOptions = [
    { value: '', label: 'Select a reason' },
    // { value: 'Customer purchase', label: 'Customer purchase' },
    { value: 'Damaged goods', label: 'Damaged goods' },
    { value: 'Expired items', label: 'Expired items' },
    { value: 'Staff consumption', label: 'Staff consumption' },
    { value: 'Lost/stolen', label: 'Lost/stolen' },
    { value: 'Stock correction', label: 'Stock correction' },
    { value: 'Batch adjustment', label: 'Batch adjustment' },
    { value: 'Other', label: 'Other' }
  ];

  // Reset form when modal opens/closes or item changes. A single-variant
  // product (the common case) auto-selects its one variant silently --
  // same experience as before this picker existed. A multi-variant
  // product starts unselected, forcing a real pick before anything else
  // is enabled (see the disabled condition on the submit button below).
  useEffect(() => {
    if (isOpen && item) {
      const variants = item.variants || [];
      const autoSelectedId = variants.length === 1 ? variants[0]._id : '';

      setUpdateType('add');
      setSelectedVariantId(autoSelectedId);
      setSelectedBatch('');
      setQuantity('');
      setReason('');
      setErrors({});
      fetchActiveBatches(autoSelectedId || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item]);

  // Get batch options for dropdown
  const getBatchOptions = () => {
    const options = [{ value: '', label: 'Select a batch' }];
    
    if (updateType === 'add') {
      // For adding stock, allow creating new batch or adding to existing
      options.push({ value: 'new_batch', label: '+ Create New Batch' });
      
      // Sort batches by creation date and add sequential labels
      const sortedBatches = [...activeBatches].sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));
      
      sortedBatches.forEach((batch, index) => {
        const batchNumber = index + 1;
        options.push({
          value: batch._id,
          label: `Batch ${batchNumber} - ${batch.batchCode} (${batch.quantityRemaining} remaining)`
        });
      });
    } else {
      // For removing stock, only show batches with remaining quantity (FIFO order)
      const availableBatches = activeBatches
        .filter(batch => batch.quantityRemaining > 0)
        .sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));
      
      availableBatches.forEach((batch, index) => {
        const batchNumber = index + 1;
        options.push({
          value: batch._id,
          label: `Batch ${batchNumber} - ${batch.batchCode} (${batch.quantityRemaining} available)`
        });
      });
    }
    
    return options;
  };

  const getSelectedBatchInfo = () => {
    if (!selectedBatch || selectedBatch === 'new_batch') return null;
    return activeBatches.find(batch => batch._id === selectedBatch);
  };

  const handleQuantityChange = (e) => {
    const value = e.target.value;
    setQuantity(value);
    
    if (errors.quantity) {
      setErrors(prev => ({ ...prev, quantity: '' }));
    }
  };

  const handleReasonChange = (value) => {
    setReason(value);
    if (errors.reason) {
      setErrors(prev => ({ ...prev, reason: '' }));
    }
  };

  const handleBatchChange = (value) => {
    setSelectedBatch(value);
    if (errors.batch) {
      setErrors(prev => ({ ...prev, batch: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if ((item.variants || []).length > 1 && !selectedVariantId) {
      newErrors.variant = 'Please select which variant you\'re updating';
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      newErrors.quantity = 'Please enter a valid quantity';
    }

    if (updateType === 'subtract') {
      if (!selectedBatch) {
        newErrors.batch = 'Please select a batch to remove stock from';
      } else {
        const batch = getSelectedBatchInfo();
        if (batch && parseFloat(quantity) > batch.quantityRemaining) {
          newErrors.quantity = `Cannot remove more than available in batch (${batch.quantityRemaining})`;
        }
      }
    }

    if (updateType === 'add' && !selectedBatch) {
      newErrors.batch = 'Please select a batch or create a new one';
    }
    
    if (!reason.trim()) {
      newErrors.reason = 'Please provide a reason for this stock update';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const updateData = {
        type: updateType,
        quantity: parseFloat(quantity),
        reason: reason.trim(),
        batchId: selectedBatch === 'new_batch' ? null : selectedBatch,
        createNewBatch: selectedBatch === 'new_batch',
        variantId: selectedVariantId || undefined
      };
      
      await onSubmit(item._id, updateData);
      
      // Reset form and close modal
      setQuantity('');
      setReason('');
      setSelectedBatch('');
      setErrors({});
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to update stock' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // For a multi-variant product, "current stock" means the selected
  // variant's own number, not the product-wide total across every
  // variant -- falls back to the product's own fields for a
  // single-variant product (unchanged from before this picker existed).
  const getCurrentStockBase = () => {
    const variant = getSelectedVariant();
    if (variant) {
      return { quantityInStock: variant.quantityInStock || 0, reorderLevel: variant.reorderLevel ?? item?.reorderLevel };
    }
    return { quantityInStock: item?.quantityInStock || 0, reorderLevel: item?.reorderLevel };
  };

  const calculateNewStock = () => {
    const { quantityInStock } = getCurrentStockBase();
    if (!quantity || !item) return quantityInStock;

    const change = parseFloat(quantity) || 0;

    if (updateType === 'add') {
      return quantityInStock + change;
    } else {
      return Math.max(0, quantityInStock - change);
    }
  };

  const getStatusColor = (stock) => {
    if (!item) return 'text-gray-600';
    const { reorderLevel } = getCurrentStockBase();
    if (stock === 0) return 'text-red-600';
    if (stock <= reorderLevel) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusText = (stock) => {
    if (!item) return 'Unknown';
    const { reorderLevel } = getCurrentStockBase();
    if (stock === 0) return 'Out of Stock';
    if (stock <= reorderLevel) return 'Low Stock';
    return 'In Stock';
  };

  if (!isOpen || !item) return null;

  const newStock = calculateNewStock();
  const selectedBatchInfo = getSelectedBatchInfo();

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-100 rounded-xl">
              <Package className="w-6 h-6 text-brand-800" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Update Stock by Batch</h2>
              <p className="text-sm text-gray-500">{item.productName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Current Stock Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Stock</p>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-2xl font-bold text-gray-900">{getCurrentStockBase().quantityInStock}</span>
                <span className="text-sm text-gray-500">{item.unitOfMeasure}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Batches</p>
              <div className="text-2xl font-bold text-brand-800">
                {loading ? '...' : activeBatches.length}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6">
            {errors.submit && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Variant Selection -- only rendered for a product with more
                than one variant; a simple product auto-selects its one
                variant on open and never sees this at all. */}
            {(item.variants || []).length > 1 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Which variant?
                </label>
                <CustomDropdown
                  options={getVariantOptions()}
                  value={selectedVariantId}
                  onChange={handleVariantChange}
                  placeholder="Select a variant"
                  error={!!errors.variant}
                />
                {errors.variant && (
                  <p className="text-red-500 text-xs mt-1">{errors.variant}</p>
                )}
              </div>
            )}

            {/* Update Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What do you want to do?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUpdateType('add')}
                  className={`p-4 border rounded-xl text-center transition-all ${
                    updateType === 'add'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Plus className={`w-6 h-6 mx-auto mb-2 ${updateType === 'add' ? 'text-green-600' : 'text-gray-400'}`} />
                  <div className={`text-sm font-medium ${updateType === 'add' ? 'text-green-700' : 'text-gray-700'}`}>Add Stock</div>
                  <div className="text-xs text-gray-500">New delivery, returns</div>
                </button>

                <button
                  type="button"
                  onClick={() => setUpdateType('subtract')}
                  className={`p-4 border rounded-xl text-center transition-all ${
                    updateType === 'subtract'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Minus className={`w-6 h-6 mx-auto mb-2 ${updateType === 'subtract' ? 'text-red-600' : 'text-gray-400'}`} />
                  <div className={`text-sm font-medium ${updateType === 'subtract' ? 'text-red-700' : 'text-gray-700'}`}>Remove Stock</div>
                  <div className="text-xs text-gray-500">Sales, damage, loss</div>
                </button>
              </div>
            </div>

            {/* Batch Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Batch {updateType === 'subtract' && '(FIFO Order)'}
              </label>
              {loading ? (
                <div className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500">
                  Loading batches...
                </div>
              ) : (
                <CustomDropdown
                  options={getBatchOptions()}
                  value={selectedBatch}
                  onChange={handleBatchChange}
                  placeholder="Select a batch"
                  error={!!errors.batch}
                />
              )}
              {errors.batch && (
                <p className="text-red-500 text-xs mt-1">{errors.batch}</p>
              )}
              
              {/* Batch Info Display */}
              {selectedBatchInfo && (
                <div className="mt-2 p-3 bg-brand-50 rounded-lg border border-brand-200">
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Batch:</span>
                      <span className="font-medium text-gray-600">
                        {(() => {
                          const sortedBatches = [...activeBatches].sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));
                          const batchIndex = sortedBatches.findIndex(batch => batch._id === selectedBatchInfo._id);
                          return `Batch ${batchIndex + 1} (${selectedBatchInfo.batchCode})`;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Available:</span>
                      <span className="font-medium text-gray-600">{selectedBatchInfo.quantityRemaining} {item.unitOfMeasure}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Received:</span>
                      <span className="font-medium text-gray-600">{new Date(selectedBatchInfo.dateReceived).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Time:</span>
                      <span className="font-medium text-gray-600">{new Date(selectedBatchInfo.dateReceived).toLocaleTimeString()}</span>
                    </div>
                    {selectedBatchInfo.expiryDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Expires:</span>
                        <span className="font-medium text-gray-600">{new Date(selectedBatchInfo.expiryDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* New Batch Info */}
              {selectedBatch === 'new_batch' && (
                <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start space-x-2">
                    <Plus className="w-4 h-4 text-green-600 mt-0.5" />
                    <div className="text-xs text-green-700">
                      <p className="font-medium">Creating New Batch</p>
                      <p>Will be labeled as Batch {activeBatches.length + 1}</p>
                      <p>A new batch will be created with current product pricing</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quantity Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity to {updateType === 'add' ? 'Add' : 'Remove'}
              </label>
              <input
                type="number"
                value={quantity}
                onChange={handleQuantityChange}
                min="0"
                step="0.01"
                placeholder="Enter quantity"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black text-center text-lg font-semibold ${
                  errors.quantity ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.quantity && (
                <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>
              )}
            </div>

            {/* Reason Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Why are you {updateType === 'add' ? 'adding' : 'removing'} stock?
              </label>
              <CustomDropdown
                options={updateType === 'add' ? addReasonOptions : subtractReasonOptions}
                value={reason}
                onChange={handleReasonChange}
                placeholder="Select a reason"
                error={!!errors.reason}
              />
              {errors.reason && (
                <p className="text-red-500 text-xs mt-1">{errors.reason}</p>
              )}
            </div>

            {/* Preview New Stock */}
            {quantity && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">New total stock:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">{newStock} {item.unitOfMeasure}</span>
                    {updateType === 'add' ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                </div>
                <div className="text-xs">
                  <span className={`font-medium ${getStatusColor(newStock)}`}>
                    {getStatusText(newStock)}
                  </span>
                  {newStock <= item.reorderLevel && newStock > 0 && (
                    <span className="text-yellow-600 ml-2">• Consider restocking soon</span>
                  )}
                  {newStock === 0 && (
                    <span className="text-red-600 ml-2">• Item will be out of stock</span>
                  )}
                </div>
              </div>
            )}

            {/* Warning for FIFO */}
            {updateType === 'subtract' && activeBatches.length > 1 && (
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-xs text-yellow-700">
                    <p className="font-medium">FIFO (First In, First Out)</p>
                    <p>Batches are ordered by receipt date. Oldest batches are processed first for sales and removals.</p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Fixed Footer with Action Buttons */}
        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !quantity || !reason || !selectedBatch || ((item.variants || []).length > 1 && !selectedVariantId)}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                updateType === 'add'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </div>
              ) : (
                `${updateType === 'add' ? 'Add' : 'Remove'} Stock`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
