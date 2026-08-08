"use client";
import React, { useState } from "react";
import { 
  X, 
  MapPin, 
  Phone, 
  User, 
  Package, 
  Calendar, 
  Clock, 
  Truck, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  DollarSign,
  FileText,
  Navigation
} from "lucide-react";

export default function DeliveryDetailsPanel({ isOpen, onClose, delivery }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!delivery) return null;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Format date and time
  const formatDateTime = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'text-green-600 bg-green-100 border-green-200';
      case 'scheduled': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'in_transit': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'failed': return 'text-red-600 bg-red-100 border-red-200';
      case 'cancelled': return 'text-gray-600 bg-gray-100 border-gray-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered': return CheckCircle;
      case 'scheduled': return Clock;
      case 'in_transit': return Truck;
      case 'failed': return XCircle;
      case 'cancelled': return XCircle;
      default: return Clock;
    }
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-blue-600 bg-blue-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const StatusIcon = getStatusIcon(delivery.status);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Sliding Panel */}
      <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-teal-100 rounded-xl">
                <Truck className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delivery Details</h3>
                <p className="text-sm text-gray-500">Transaction #{delivery.transactionId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Status and Priority */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${getStatusColor(delivery.status)}`}>
                <StatusIcon className="w-4 h-4" />
                <span className="text-sm font-medium capitalize">{delivery.status}</span>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(delivery.priority)}`}>
                {delivery.priority} priority
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="w-4 h-4" />
                <span>Scheduled: {formatDateTime(delivery.scheduledDate)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Time Slot: {delivery.timeSlot === 'anytime' ? 'Anytime' : delivery.timeSlot}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-teal-500 text-teal-600 bg-teal-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('items')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'items'
                    ? 'border-teal-500 text-teal-600 bg-teal-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Items ({delivery.items.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-teal-500 text-teal-600 bg-teal-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                History
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="p-6 space-y-6">
                {/* Customer Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Customer Information
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Name:</span>
                      <span className="text-gray-900 font-medium">{delivery.customer.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Phone:</span>
                      <span className="text-gray-900 font-medium">{delivery.customer.phone}</span>
                    </div>
                    {delivery.customer.email && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Email:</span>
                        <span className="text-gray-900">{delivery.customer.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Address */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    Delivery Address
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-900 mb-2">{delivery.deliveryAddress.fullAddress}</p>
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">City:</span> {delivery.deliveryAddress.city}
                      </div>
                      <div>
                        <span className="font-medium">State:</span> {delivery.deliveryAddress.state}
                      </div>
                      {delivery.deliveryAddress.postalCode && (
                        <div>
                          <span className="font-medium">Postal Code:</span> {delivery.deliveryAddress.postalCode}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Country:</span> {delivery.deliveryAddress.country}
                      </div>
                    </div>
                    
                    {/* Google Maps Link */}
                    <button 
                      onClick={() => {
                        const address = encodeURIComponent(delivery.deliveryAddress.fullAddress);
                        window.open(`https://maps.google.com/maps?q=${address}`, '_blank');
                      }}
                      className="mt-3 flex items-center space-x-2 text-xs text-teal-600 hover:text-teal-700"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Open in Google Maps</span>
                    </button>
                  </div>
                </div>

                {/* Delivery Details */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <Truck className="w-4 h-4 mr-2" />
                    Delivery Details
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Method:</span>
                      <span className="text-gray-900 font-medium capitalize">{delivery.deliveryMethod.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Delivery Fee:</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(delivery.deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Payment Status:</span>
                      <span className={`font-medium ${
                        delivery.paymentStatus === 'paid' ? 'text-green-600' : 
                        delivery.paymentStatus === 'pending' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {delivery.paymentStatus.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="text-gray-900 font-bold">{formatCurrency(delivery.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Delivery Notes */}
                {delivery.deliveryNotes && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Delivery Notes
                    </h4>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700">{delivery.deliveryNotes}</p>
                    </div>
                  </div>
                )}

                {/* Source Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Source</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      delivery.deliveryType === 'order' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {delivery.deliveryType === 'order' ? 'From Order' : 'Direct POS Sale'}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Created on {new Date(delivery.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'items' && (
              <div className="p-6">
                <div className="space-y-4">
                  {delivery.items.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{item.productName}</h5>
                          {item.sku && (
                            <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(item.total)}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(item.unitPrice)} each</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Quantity: {item.quantity}</span>
                        </div>
                        
                        {/* Delivered quantity tracking */}
                        {item.deliveredQuantity !== undefined && (
                          <div className="text-xs">
                            <span className={`px-2 py-1 rounded-full ${
                              item.deliveredQuantity >= item.quantity 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {item.deliveredQuantity >= item.quantity ? 'Delivered' : `${item.deliveredQuantity}/${item.quantity} delivered`}
                            </span>
                          </div>
                        )}
                      </div>

                      {item.notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                          <strong>Notes:</strong> {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Items Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Total Items:</span>
                    <span className="font-medium">{delivery.items.length}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Total Quantity:</span>
                    <span className="font-medium">{delivery.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200">
                    <span className="text-gray-900">Subtotal:</span>
                    <span className="text-gray-900">{formatCurrency(delivery.totalAmount - delivery.deliveryFee)}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-6">
                <div className="space-y-4">
                  {delivery.statusHistory && delivery.statusHistory.length > 0 ? (
                    delivery.statusHistory.slice().reverse().map((history, index) => {
                      const HistoryIcon = getStatusIcon(history.status);
                      return (
                        <div key={index} className="flex space-x-3">
                          <div className="flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              index === 0 ? 'bg-teal-100' : 'bg-gray-100'
                            }`}>
                              <HistoryIcon className={`w-4 h-4 ${index === 0 ? 'text-teal-600' : 'text-gray-500'}`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 capitalize">
                                {history.status.replace('_', ' ')}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(history.timestamp).toLocaleDateString('en-GB', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            {history.notes && (
                              <p className="text-sm text-gray-600 mt-1">{history.notes}</p>
                            )}
                            {history.updatedBy && (
                              <p className="text-xs text-gray-500 mt-1">
                                Updated by: {history.updatedBy.firstName} {history.updatedBy.lastName}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No status history available</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex space-x-3">
              <button 
                onClick={() => {
                  const address = encodeURIComponent(delivery.deliveryAddress.fullAddress);
                  window.open(`https://maps.google.com/maps?q=${address}`, '_blank');
                }}
                className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Directions
              </button>
              <button 
                onClick={() => window.open(`tel:${delivery.customer.phone}`, '_self')}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
              >
                <Phone className="w-4 h-4 mr-2" />
                Call Customer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
