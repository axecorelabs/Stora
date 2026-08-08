"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Package, ShoppingBag, ArrowLeft, MapPin, Phone, Mail, Calendar, Tag } from "lucide-react";

export default function OrderConfirmationPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/orders/${resolvedParams.id}`, {
          credentials: 'include'
        });
        const data = await response.json();

        if (response.ok && data.success) {
          setOrder(data.order);
        } else {
          setError(data.message || 'Order not found');
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    if (resolvedParams.id) {
      fetchOrder();
    }
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-emerald-600 mb-4 mx-auto"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-4">📦</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Order Not Found'}</h2>
          <p className="text-gray-600 mb-6">
            We couldn't find the order you're looking for.
          </p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const formatPrice = (price) => {
    return `₦${price?.toLocaleString()}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      shipped: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 lg:py-12">
      <div className="max-w-4xl mx-auto px-6">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            Order Placed Successfully!
          </h1>
          <p className="text-gray-600 text-lg">
            Thank you for your order. We've sent the details to the store owners.
          </p>
        </div>

        {/* Order Number & Status Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Order Number</p>
              <p className="text-2xl font-bold text-gray-900">{order.orderNumber}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full font-semibold text-sm ${getStatusColor(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Order Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Total Items</p>
                <p className="text-sm font-medium text-gray-900">{order.itemCount} items</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatPrice(order.totalAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Delivery Address
          </h2>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="font-semibold text-gray-900 mb-1">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            <p className="text-gray-600 text-sm mb-2">
              {order.shippingAddress.city}, {order.shippingAddress.state}
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <span>{order.shippingAddress.phone}</span>
            </div>
          </div>
        </div>

        {/* Store Groups */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Orders Sent To:</h2>
          <div className="space-y-4">
            {order.stores?.map((storeGroup, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {storeGroup.storeName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {storeGroup.itemCount} {storeGroup.itemCount === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatPrice(storeGroup.subtotal)}
                    </p>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(storeGroup.status)}`}>
                      {storeGroup.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Items - Enhanced with Variant Display */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Order Items</h2>
          <div className="space-y-4">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex gap-4 p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow">
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                  {item.productSnapshot?.image || item.variant?.image ? (
                    <img 
                      src={item.variant?.image || item.productSnapshot.image} 
                      alt={item.productSnapshot.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      📦
                    </div>
                  )}
                  {/* Variant Badge on Image */}
                  {item.variant && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white text-[10px] text-center py-0.5 px-1">
                      Custom
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {item.productSnapshot?.productName}
                  </h4>
                  
                  {/* Variant Details */}
                  {item.variant && (
                    <div className="flex items-center gap-2 mb-2">
                      {item.variant.color && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                          {item.variant.color}
                        </span>
                      )}
                      {item.variant.size && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                          {item.variant.size}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Product Details */}
                  <div className="space-y-1 mb-2">
                    {item.productSnapshot?.category && (
                      <p className="text-xs text-gray-500">
                        Category: {item.productSnapshot.category}
                      </p>
                    )}
                    {item.productSnapshot?.sku && !item.variant?.sku && (
                      <p className="text-xs text-gray-400">
                        SKU: {item.productSnapshot.sku}
                      </p>
                    )}
                    {item.variant?.sku && (
                      <p className="text-xs text-gray-400">
                        Variant SKU: {item.variant.sku}
                      </p>
                    )}
                  </div>

                  <p className="text-sm text-gray-500 mb-2">
                    Quantity: {item.quantity} × {formatPrice(item.price)}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatPrice(item.subtotal)}
                  </p>

                  {/* Store Badge */}
                  {item.storeSnapshot?.storeName && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <Package className="w-3 h-3 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">
                        {item.storeSnapshot.storeName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount</span>
                <span className="font-semibold text-red-600">-{formatPrice(order.discount)}</span>
              </div>
            )}
            {order.shippingFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Shipping Fee</span>
                <span className="font-semibold text-gray-900">{formatPrice(order.shippingFee)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3 flex justify-between">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-emerald-600">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex-1 py-4 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
          <button
            onClick={() => router.push("/orders")}
            className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-5 h-5" />
            View All Orders
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> You will receive order confirmations via WhatsApp from each store. 
            If you have any questions about your order, please contact the respective store directly.
          </p>
        </div>
      </div>
    </div>
  );
}
