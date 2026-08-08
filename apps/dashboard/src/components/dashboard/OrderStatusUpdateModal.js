"use client";
import { useState, useEffect } from "react";
import { 
  X, 
  CheckCircle, 
  Clock, 
  Package, 
  Truck, 
  AlertCircle,
  ArrowRight,
  Info,
  MapPin,
  Calendar,
  Phone,
  MessageSquare
} from "lucide-react";
import CustomDropdown from "../ui/CustomDropdown";

export default function OrderStatusUpdateModal({ 
  isOpen, 
  onClose, 
  order, 
  onStatusUpdate, 
  isUpdating = false 
}) {
  const [selectedStatus, setSelectedStatus] = useState(order?.status || 'pending');
  const [note, setNote] = useState('');
  const [trackingInfo, setTrackingInfo] = useState({
    carrier: order?.tracking?.carrier || '',
    trackingNumber: order?.tracking?.trackingNumber || '',
    trackingUrl: order?.tracking?.trackingUrl || ''
  });
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen && order) {
      setSelectedStatus(order?.status || 'pending');
      setNote('');
      setTrackingInfo({
        carrier: order?.tracking?.carrier || '',
        trackingNumber: order?.tracking?.trackingNumber || '',
        trackingUrl: order?.tracking?.trackingUrl || ''
      });
      setShowTrackingForm(false);
      setErrors({});
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  // Define status flow and information
  const statusFlow = {
    pending: {
      title: 'Pending',
      description: 'Order received and awaiting confirmation',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      nextOptions: ['confirmed', 'cancelled'],
      explanation: 'The customer has placed an order and it\'s waiting for you to review and confirm it.'
    },
    confirmed: {
      title: 'Confirmed', 
      description: 'Order confirmed and ready for processing',
      icon: CheckCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      nextOptions: ['processing', 'cancelled'],
      explanation: 'You\'ve confirmed the order. Now you can start preparing the items for shipment.'
    },
    processing: {
      title: 'Processing',
      description: 'Order is being prepared for shipment',
      icon: Package,
      color: 'text-purple-600', 
      bgColor: 'bg-purple-100',
      nextOptions: ['shipped', 'cancelled'],
      explanation: 'You\'re currently packing and preparing the order for delivery.'
    },
    shipped: {
      title: 'Shipped',
      description: 'Order has been shipped to customer',
      icon: Truck,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      nextOptions: ['delivered'],
      explanation: 'The order has been handed over to the delivery service and is on its way to the customer.',
      requiresTracking: true
    },
    delivered: {
      title: 'Delivered',
      description: 'Order successfully delivered to customer',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      nextOptions: [],
      explanation: 'The order has been successfully delivered to the customer.'
    },
    cancelled: {
      title: 'Cancelled',
      description: 'Order has been cancelled',
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      nextOptions: [],
      explanation: 'The order has been cancelled and will not be processed further.'
    }
  };

  const currentStatus = statusFlow[order.status];
  const availableStatuses = currentStatus.nextOptions.map(status => ({
    value: status,
    label: statusFlow[status].title
  }));

  // Common carrier options
  const carrierOptions = [
    { value: '', label: 'Select carrier' },
    { value: 'GIG Logistics', label: 'GIG Logistics' },
    { value: 'DHL', label: 'DHL' },
    { value: 'FedEx', label: 'FedEx' },
    { value: 'UPS', label: 'UPS' },
    { value: 'Jumia Express', label: 'Jumia Express' },
    { value: 'Konga Express', label: 'Konga Express' },
    { value: 'RedStar Express', label: 'RedStar Express' },
    { value: 'Courier Plus', label: 'Courier Plus' },
    { value: 'Other', label: 'Other' }
  ];

  // Handle status selection
  const handleStatusChange = (status) => {
    setSelectedStatus(status);
    setShowTrackingForm(status === 'shipped');
    setErrors({});
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!selectedStatus) {
      newErrors.status = 'Please select a new status';
    }

    if (selectedStatus === 'shipped') {
      if (!trackingInfo.carrier) {
        newErrors.carrier = 'Please select a carrier';
      }
      if (!trackingInfo.trackingNumber.trim()) {
        newErrors.trackingNumber = 'Please enter a tracking number';
      }
    }

    if (!note.trim()) {
      newErrors.note = 'Please provide a reason for this status update';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle status update
  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    
    try {
      const updateData = {
        status: selectedStatus,
        note: note.trim(),
        updatedBy: 'admin'
      };

      // Add tracking info if shipping
      if (selectedStatus === 'shipped') {
        updateData.trackingInfo = {
          carrier: trackingInfo.carrier,
          trackingNumber: trackingInfo.trackingNumber.trim(),
          trackingUrl: trackingInfo.trackingUrl || null
        };
      }

      const response = await onStatusUpdate(order._id, updateData);
      
      // Show success message with sale information if applicable
      if (response && response.salesCreated) {
        alert(`Order updated successfully! ${response.salesCreated.count} sale(s) created automatically for ₦${response.salesCreated.totalAmount.toLocaleString()}`);
      } else if (response && response.saleCreationError) {
        alert(`Order updated successfully, but there was an issue creating sales: ${response.saleCreationError}`);
      }
      
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to update status' });
    }
  };

  // Get selected status info
  const selectedStatusInfo = selectedStatus ? statusFlow[selectedStatus] : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <selectedStatusInfo.icon className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Update Order Status</h2>
              <p className="text-sm text-gray-500">Order #{order.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleStatusUpdate} className="p-6 space-y-4">
          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Status *
            </label>
            <CustomDropdown
              options={availableStatuses}
              value={selectedStatus}
              onChange={handleStatusChange}
              placeholder="Select status"
            />
            {errors.status && (
              <p className="text-red-500 text-xs mt-2">{errors.status}</p>
            )}
          </div>

          {/* Tracking Information (only show when status is shipped) */}
          {showTrackingForm && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-xl">
              <h3 className="text-sm font-medium text-blue-900">Tracking Information</h3>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Carrier *
                </label>
                <CustomDropdown
                  options={carrierOptions}
                  value={trackingInfo.carrier}
                  onChange={(value) => setTrackingInfo(prev => ({ ...prev, carrier: value }))}
                  placeholder="Select delivery company"
                  error={!!errors.carrier}
                />
                {errors.carrier && (
                  <p className="text-red-500 text-xs mt-1">{errors.carrier}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tracking Number *
                </label>
                <input
                  type="text"
                  value={trackingInfo.trackingNumber}
                  onChange={(e) => setTrackingInfo(prev => ({ ...prev, trackingNumber: e.target.value }))}
                  placeholder="Enter tracking number"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm ${
                    errors.trackingNumber ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.trackingNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.trackingNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tracking URL (Optional)
                </label>
                <input
                  type="url"
                  value={trackingInfo.trackingUrl}
                  onChange={(e) => setTrackingInfo(prev => ({ ...prev, trackingUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Update Note *
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Explain why you're making this status change (this will be visible in the order timeline)
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Example: "Order confirmed and items are in stock" or "Package handed to ${trackingInfo.carrier || 'delivery company'}"`}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm ${
                errors.note ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.note && (
              <p className="text-red-500 text-xs mt-1">{errors.note}</p>
            )}
          </div>

          {/* Current Status Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Current Status:</span>
              <span className="font-medium text-gray-900 capitalize">{order.status}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating || selectedStatus === order.status}
              className="px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {isUpdating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
