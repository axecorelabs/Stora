"use client";
import { useState, useEffect } from "react";
import { X, Truck } from "lucide-react";
import CustomDropdown from "../ui/CustomDropdown";

export default function DeliveryScheduleModal({ isOpen, onClose, onSubmit, sale }) {
  const [formData, setFormData] = useState({
    customerName: sale?.customer?.name || '',
    customerPhone: sale?.customer?.phone || '',
    customerEmail: sale?.customer?.email || '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      fullAddress: ''
    },
    scheduledDate: '',
    timeSlot: 'anytime',
    deliveryMethod: 'self_delivery',
    deliveryFee: 0,
    priority: 'medium',
    paymentStatus: 'paid',
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeSlotOptions = [
    { value: 'anytime', label: 'Anytime' },
    { value: 'morning', label: 'Morning (8AM - 12PM)' },
    { value: 'afternoon', label: 'Afternoon (12PM - 5PM)' },
    { value: 'evening', label: 'Evening (5PM - 8PM)' }
  ];

  const deliveryMethodOptions = [
    { value: 'self_delivery', label: 'Self Delivery' },
    { value: 'courier', label: 'Courier Service' },
    { value: 'pickup', label: 'Customer Pickup' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'high', label: 'High Priority' },
    { value: 'urgent', label: 'Urgent' }
  ];

  const paymentStatusOptions = [
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending Payment' },
    { value: 'cash_on_delivery', label: 'Cash on Delivery' },
    { value: 'partial', label: 'Partially Paid' }
  ];

  // Pre-populate customer and address data from sale/order
  useEffect(() => {
    if (isOpen && sale) {
      // Get shipping address from processed order if available, otherwise from sale
      const shippingAddress = sale.processedOrder?.shippingAddress || sale.shippingAddress || {};
      
      // Build full address string from components
      const addressParts = [
        shippingAddress.street,
        shippingAddress.landmark,
        shippingAddress.city,
        shippingAddress.state,
        shippingAddress.postalCode,
        shippingAddress.country
      ].filter(Boolean);
      
      const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : '';

      setFormData({
        customerName: sale.customer?.name || 
                      (sale.processedOrder ? `${sale.processedOrder.customerSnapshot?.firstName || ''} ${sale.processedOrder.customerSnapshot?.lastName || ''}`.trim() : ''),
        customerPhone: sale.customer?.phone || 
                       shippingAddress.phone || 
                       sale.processedOrder?.customerSnapshot?.phone || '',
        customerEmail: sale.customer?.email || 
                       sale.processedOrder?.customerSnapshot?.email || '',
        address: {
          street: shippingAddress.street || '',
          city: shippingAddress.city || '',
          state: shippingAddress.state || '',
          postalCode: shippingAddress.postalCode || '',
          fullAddress: fullAddress
        },
        scheduledDate: '',
        timeSlot: 'anytime',
        deliveryMethod: 'self_delivery',
        deliveryFee: 0,
        priority: 'medium',
        paymentStatus: sale.paymentMethod === 'cash' ? 'cash_on_delivery' : 'paid',
        notes: sale.processedOrder?.customerNotes || ''
      });
      setErrors({});
    }
  }, [isOpen, sale]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDropdownChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }

    if (!formData.customerPhone.trim()) {
      newErrors.customerPhone = 'Customer phone is required';
    }

    if (!formData.address.city.trim()) {
      newErrors['address.city'] = 'City is required';
    }

    if (!formData.address.state.trim()) {
      newErrors['address.state'] = 'State is required';
    }

    if (!formData.address.fullAddress.trim()) {
      newErrors['address.fullAddress'] = 'Full address is required';
    }

    if (!formData.scheduledDate) {
      newErrors.scheduledDate = 'Delivery date is required';
    } else {
      const selectedDate = new Date(formData.scheduledDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        newErrors.scheduledDate = 'Delivery date cannot be in the past';
      }
    }

    if (formData.deliveryFee < 0) {
      newErrors.deliveryFee = 'Delivery fee cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Convert the scheduled date to ensure it's stored correctly
      const scheduledDate = new Date(formData.scheduledDate + 'T00:00:00.000Z');
      
      const deliveryDataToSubmit = {
        ...formData,
        scheduledDate: scheduledDate.toISOString()
      };
      
      await onSubmit(deliveryDataToSubmit);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to schedule delivery' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <Truck className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Schedule Delivery</h2>
              <p className="text-sm text-gray-500">
                {sale.isFromOrder ? 'Order' : 'Sale'}: {sale.transactionId} • {formatCurrency(sale.total || 0)}
                {sale.processedOrder && (
                  <span className="text-blue-600 ml-2">
                    (Order #{sale.processedOrder.orderNumber})
                  </span>
                )}
              </p>
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Items Summary */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Items to Deliver</h3>
              <div className="space-y-2">
                {sale.items?.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{item.productName}</span>
                      {item.sku && <span className="text-gray-500 ml-2">({item.sku})</span>}
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </div>
                      <div className="text-gray-500">
                        = {formatCurrency(item.total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between text-sm text-gray-900 font-medium">
                <span>Total Items:</span>
                <span>{sale.items?.length || 0} ({sale.items?.reduce((sum, item) => sum + item.quantity, 0)} units)</span>
              </div>
            </div>

            {/* Customer Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors.customerName ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.customerName && (
                    <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors.customerPhone ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.customerPhone && (
                    <p className="text-red-500 text-xs mt-1">{errors.customerPhone}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Address *
                  </label>
                  <textarea
                    name="address.fullAddress"
                    value={formData.address.fullAddress}
                    onChange={handleChange}
                    rows={2}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors['address.fullAddress'] ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter complete delivery address"
                  />
                  {errors['address.fullAddress'] && (
                    <p className="text-red-500 text-xs mt-1">{errors['address.fullAddress']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    name="address.city"
                    value={formData.address.city}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors['address.city'] ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors['address.city'] && (
                    <p className="text-red-500 text-xs mt-1">{errors['address.city']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    name="address.state"
                    value={formData.address.state}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors['address.state'] ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors['address.state'] && (
                    <p className="text-red-500 text-xs mt-1">{errors['address.state']}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery Schedule */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Schedule</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Date *
                  </label>
                  <input
                    type="date"
                    name="scheduledDate"
                    value={formData.scheduledDate}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors.scheduledDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.scheduledDate && (
                    <p className="text-red-500 text-xs mt-1">{errors.scheduledDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Slot
                  </label>
                  <CustomDropdown
                    options={timeSlotOptions}
                    value={formData.timeSlot}
                    onChange={(value) => handleDropdownChange('timeSlot', value)}
                    placeholder="Select time slot"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Method
                  </label>
                  <CustomDropdown
                    options={deliveryMethodOptions}
                    value={formData.deliveryMethod}
                    onChange={(value) => handleDropdownChange('deliveryMethod', value)}
                    placeholder="Select delivery method"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <CustomDropdown
                    options={priorityOptions}
                    value={formData.priority}
                    onChange={(value) => handleDropdownChange('priority', value)}
                    placeholder="Select priority"
                  />
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Fee
                  </label>
                  <input
                    type="number"
                    name="deliveryFee"
                    value={formData.deliveryFee}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors.deliveryFee ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.deliveryFee && (
                    <p className="text-red-500 text-xs mt-1">{errors.deliveryFee}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Status
                  </label>
                  <CustomDropdown
                    options={paymentStatusOptions}
                    value={formData.paymentStatus}
                    onChange={(value) => handleDropdownChange('paymentStatus', value)}
                    placeholder="Select payment status"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                    placeholder="Special instructions or notes for delivery"
                  />
                </div>
              </div>
            </div>

            {/* Enhanced Delivery Summary */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Delivery Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {sale.isFromOrder ? 'Order' : 'Sale'} Total:
                  </span>
                  <span className="text-gray-900">{formatCurrency(sale.total || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery Fee:</span>
                  <span className="text-gray-900">{formatCurrency(formData.deliveryFee)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t border-gray-200">
                  <span className="text-gray-900">Total with Delivery:</span>
                  <span className="text-gray-900">
                    {formatCurrency((sale.total || 0) + parseFloat(formData.deliveryFee || 0))}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Delivery Type: {sale.isFromOrder ? 'Order Fulfillment' : 'Direct Sale Delivery'}
                  {sale.processedOrder && (
                    <span className="block">Original Order: #{sale.processedOrder.orderNumber}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scheduling...
                </>
              ) : (
                'Schedule Delivery'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
