"use client";
import { X, Package, MapPin, Phone, Calendar, Clock, CheckCircle, Truck, Box } from "lucide-react";
import { useEffect, useState } from "react";

export default function OrderDetailsPanel({ 
  isOpen, 
  onClose, 
  order, 
  primaryColor = '#0D9488',
  secondaryColor = '#F3F4F6',
  currency = 'NGN'
}) {
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!order) return null;

  const formatPrice = (price) => {
    if (currency === 'NGN') {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      processing: 'bg-purple-100 text-purple-800 border-purple-200',
      shipped: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      delivered: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      refunded: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'shipped': return <Truck className="w-4 h-4" />;
      case 'processing': return <Box className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel with responsive positioning */}
      <div
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: 'min(600px, 100vw)',
          right: isMobile ? '0' : (isOpen ? '10px' : '0'), // Remove margin on mobile
          maxHeight: isMobile ? '100vh' : '95vh', // Full height on mobile
          top: isMobile ? '0' : '2.5vh', // Start from top on mobile
          borderRadius: isMobile ? '0' : '16px' // No border radius on mobile
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header with Store Colors */}
          <div 
            className={`flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white ${isMobile ? '' : 'rounded-t-2xl'}`}
            style={{ backgroundColor: `${primaryColor}05` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <Package className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Order Details</h2>
                  <p className="text-sm text-gray-600">#{order.orderNumber}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Status and Total Row */}
            <div className="flex items-center justify-between mt-4">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
                {getStatusIcon(order.status)}
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="text-xl font-bold" style={{ color: primaryColor }}>
                  {formatPrice(order.totalAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div 
                className="rounded-lg p-3 border border-gray-100"
                style={{ backgroundColor: secondaryColor }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-600">Order Date</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDate(order.createdAt)}
                </p>
              </div>

              <div 
                className="rounded-lg p-3 border border-gray-100"
                style={{ backgroundColor: secondaryColor }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Box className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-600">Total Items</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {order.itemCount} items
                </p>
              </div>
            </div>

            {/* Delivery Information with Store Colors */}
            <div 
              className="rounded-lg p-4 border"
              style={{ 
                backgroundColor: `${primaryColor}10`,
                borderColor: `${primaryColor}30`
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
                <h3 className="text-sm font-bold text-gray-900">Delivery Address</h3>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-gray-900 text-sm">
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                </p>
                <p className="text-sm text-gray-700">
                  {order.shippingAddress.city}, {order.shippingAddress.state}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Phone className="w-3 h-3 text-gray-600" />
                  <span className="text-sm text-gray-900">{order.shippingAddress.phone}</span>
                </div>
              </div>
            </div>

            {/* Store Information with Store Colors */}
            {order.stores && order.stores.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">
                  Store{order.stores.length > 1 ? 's' : ''} ({order.stores.length})
                </h3>
                <div className="space-y-2">
                  {order.stores.map((store, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${primaryColor}20` }}
                        >
                          <span className="text-xs font-bold" style={{ color: primaryColor }}>
                            {store.storeName?.charAt(0)?.toUpperCase() || 'S'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{store.storeName}</p>
                          <p className="text-xs text-gray-500">
                            {store.itemCount} {store.itemCount === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                        <p className="text-sm font-bold" style={{ color: primaryColor }}>
                          {formatPrice(store.subtotal)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Items */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                Order Items ({order.items?.length || 0})
              </h3>
              <div className="space-y-3">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex gap-3 p-3 border border-gray-100 rounded-lg">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                      {item.productSnapshot?.image || item.variant?.image ? (
                        <img 
                          src={item.variant?.image || item.productSnapshot.image} 
                          alt={item.productSnapshot.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">
                          📦
                        </div>
                      )}
                      {item.variant && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] text-center py-0.5">
                          Custom
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                        {item.productSnapshot?.productName}
                      </h4>
                      
                      {/* Variant Info */}
                      {item.variant && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {item.variant.color && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded">
                              {item.variant.color}
                            </span>
                          )}
                          {item.variant.size && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded">
                              {item.variant.size}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity} × {formatPrice(item.price)}
                        </p>
                        <p className="text-sm font-bold text-gray-900">
                          {formatPrice(item.subtotal)}
                        </p>
                      </div>

                      {item.variant?.sku && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          SKU: {item.variant.sku}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary with Store Colors */}
            <div 
              className="rounded-lg p-4 border border-gray-200"
              style={{ backgroundColor: secondaryColor }}
            >
              <h3 className="text-sm font-bold text-gray-900 mb-3">Order Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">{formatPrice(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-semibold text-red-600">-{formatPrice(order.discount)}</span>
                  </div>
                )}
                {order.shippingFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping Fee</span>
                    <span className="font-semibold text-gray-900">{formatPrice(order.shippingFee)}</span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-2 flex justify-between">
                  <span className="font-bold text-gray-900 text-sm">Total</span>
                  <span className="text-lg font-bold" style={{ color: primaryColor }}>
                    {formatPrice(order.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Payment Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {order.paymentInfo.method.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Status</span>
                  <span className={`font-semibold ${
                    order.paymentInfo.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {order.paymentInfo.status.charAt(0).toUpperCase() + order.paymentInfo.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions with Store Colors */}
          {order.canBeCancelled && (
            <div className={`flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white ${isMobile ? '' : 'rounded-b-2xl'}`}>
              <button className="w-full py-3 border-2 border-red-300 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors text-sm">
                Cancel Order
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
