"use client";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { CheckCircle, Package, ShoppingBag, ArrowLeft, MapPin, Phone, Calendar, MessageCircle, Clock, X, AlertCircle, CreditCard } from "lucide-react";
import useStoreStore from "@/stores/storeStore";
import { useAuth } from "@/contexts/AuthContext";
import { usePaystackReady } from "@/hooks/usePaystackReady";
import WhatsAppContactModal from "@/components/orders/WhatsAppContactModal";
import StoreSocialsModal from "@/components/orders/StoreSocialsModal";

export default function StoreOrderDetailsPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { customer } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showStoreSocialsModal, setShowStoreSocialsModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [isPayingNow, setIsPayingNow] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [payNowError, setPayNowError] = useState(null);
  const { markReady: markPaystackReady, waitForReady: waitForPaystackReady } = usePaystackReady();

  // Get store from Zustand store
  const { currentStore, fetchStore } = useStoreStore();

  // Fetch store if not loaded
  useEffect(() => {
    if (resolvedParams.slug && (!currentStore || currentStore.website?.websitePath !== resolvedParams.slug)) {
      fetchStore(resolvedParams.slug);
    }
  }, [resolvedParams.slug, currentStore, fetchStore]);

  // Extracted so the payment-retry flow below can re-fetch the order (to
  // pick up the new payment/order status) without a full page reload.
  const fetchOrder = useCallback(async () => {
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
  }, [resolvedParams.id]);

  // Fetch order data
  useEffect(() => {
    if (resolvedParams.id) {
      fetchOrder();
    }
  }, [resolvedParams.id, fetchOrder]);

  // Show WhatsApp modal for pending orders
  useEffect(() => {
    if (order && order.status === 'pending' && order.stores?.length > 0) {
      // Show modal after a short delay
      const timer = setTimeout(() => {
        setShowWhatsAppModal(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [order]);

  // Store colors with fallbacks
  const primaryColor = currentStore?.branding?.primaryColor || '#0D9488';
  const secondaryColor = currentStore?.branding?.secondaryColor || '#F3F4F6';
  const currency = currentStore?.settings?.currency || 'NGN';

  const formatWhatsAppMessage = (storeName, orderNumber, customerName, itemCount) => {
    return encodeURIComponent(
      `Hi ${storeName}! 👋\n\n` +
      `I placed an order through your Stora store and would like to confirm the details:\n\n` +
      `📦 Order #${orderNumber}\n` +
      `👤 Customer: ${customerName}\n` +
      `📋 Items: ${itemCount} ${itemCount === 1 ? 'item' : 'items'}\n\n` +
      `Could you please confirm my order and let me know:\n` +
      `• Order status and estimated preparation time\n` +
      `• Delivery/pickup details\n` +
      `• Any special instructions\n\n` +
      `Thank you! 😊`
    );
  };

  const openWhatsApp = (storePhone, storeName, itemCount) => {
    console.log('Opening WhatsApp with:', { storePhone, storeName, itemCount });
    
    if (!storePhone) {
      alert(`Sorry, ${storeName} doesn't have a WhatsApp number available.`);
      return;
    }

    // Clean and format phone number
    const cleanPhone = storePhone.replace(/\s/g, '').replace(/^0/, '234');
    const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;
    
    console.log('Formatted phone:', formattedPhone);
    
    const customerName = `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
    const message = formatWhatsAppMessage(storeName, order?.orderNumber, customerName, itemCount);
    
    // Open WhatsApp
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;
    console.log('WhatsApp URL:', whatsappUrl);
    
    // Try to open in new window/tab
    const newWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    
    // Fallback: if popup blocked, try direct navigation
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
      window.location.href = whatsappUrl;
    }
  };

  const handleMessageVendor = (storeGroup) => {
    setSelectedStore(storeGroup);
    setShowStoreSocialsModal(true);
  };

  const handleContactAllVendors = () => {
    setShowWhatsAppModal(true);
  };

  // Format price with currency
  const formatPrice = (price) => {
    if (currency === 'NGN') {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
  };

  // Format date to readable string
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Whether this order can still be paid for online -- mirrors the checks
  // /api/payments/initiate itself makes (order not cancelled/refunded,
  // payment method is paystack, not already completed), so the button only
  // shows when an attempt would actually be plausible. The API is still
  // the real gate; this just avoids showing a button that's certain to
  // fail with "order no longer available for payment".
  const canPayNow = order?.payment?.method === 'paystack'
    && order?.payment?.status !== 'completed'
    && !['cancelled', 'refunded'].includes(order?.status);

  // Fills the gap this order page always had: there was no way to resume
  // payment on an order once the cart (and the checkout modal that
  // triggers Paystack) was gone -- a closed popup, a failed init call, or
  // any other interruption left the order permanently unpaid with no path
  // forward except re-shopping from scratch. This reuses the same
  // initiate -> popup -> verify sequence as the cart page's checkout flow.
  const handlePayNow = async () => {
    setPayNowError(null);
    setIsPayingNow(true);

    const paystackOk = await waitForPaystackReady();
    if (!paystackOk) {
      setPayNowError("Payment isn't ready yet -- please check your connection and try again in a moment");
      setIsPayingNow(false);
      return;
    }

    try {
      setIsConfirmingPayment(true);
      const initRes = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: order.id }),
      });
      const initData = await initRes.json();

      if (!initRes.ok || !initData.success) {
        setPayNowError(initData.message || "Could not start payment");
        setIsConfirmingPayment(false);
        setIsPayingNow(false);
        return;
      }

      const popup = new window.PaystackPop();
      popup.resumeTransaction(initData.accessCode, {
        onSuccess: async () => {
          try {
            const verifyRes = await fetch(
              `/api/payments/verify?reference=${encodeURIComponent(initData.reference)}`,
              { credentials: "include" }
            );
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
              setPayNowError(verifyData.message || "Payment could not be confirmed");
            } else {
              // Pick up the new payment/order status rather than leaving
              // stale "Pending" on screen.
              await fetchOrder();
            }
          } catch (error) {
            console.error("Error verifying payment:", error);
            setPayNowError("Payment could not be confirmed. Please contact support.");
          } finally {
            setIsConfirmingPayment(false);
            setIsPayingNow(false);
          }
        },
        onCancel: () => {
          setIsConfirmingPayment(false);
          setIsPayingNow(false);
        },
      });
    } catch (error) {
      console.error("Error starting payment:", error);
      setPayNowError("Could not start payment. Please try again.");
      setIsConfirmingPayment(false);
      setIsPayingNow(false);
    }
  };

  // Get status color class
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

  if (loading || !currentStore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-4 mb-4 mx-auto"
            style={{ borderTopColor: primaryColor }}
          ></div>
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
            onClick={() => router.push(`/${resolvedParams.slug}`)}
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 lg:py-12">
      <Script
        src="https://js.paystack.co/v1/inline.js"
        strategy="afterInteractive"
        onLoad={markPaystackReady}
      />

      {isConfirmingPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl px-6 py-5 flex items-center gap-3 shadow-lg">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            <span className="text-sm font-medium text-gray-900">Confirming payment...</span>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Mobile-optimized Success Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div 
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12" style={{ color: primaryColor }} />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            Order Details
          </h1>
          <p className="text-gray-600 text-base sm:text-lg px-4">
            Thank you for shopping with {currentStore?.storeName || 'us'}
          </p>
        </div>

        {/* Mobile-optimized Order Number & Status Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4 mb-4">
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Order Number</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{order.orderNumber}</p>
            </div>
            <div className="flex justify-center sm:justify-end">
              <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold text-xs sm:text-sm ${getStatusColor(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
          </div>
          
          {/* Mobile: Stacked layout, Desktop: Grid */}
          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Order Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Total Items</p>
                <p className="text-sm font-medium text-gray-900">{order.itemCount} items</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="text-base sm:text-lg font-bold" style={{ color: primaryColor }}>
                  {formatPrice(order.totalAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-optimized Shipping Address */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
            Delivery Address
          </h2>
          <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4">
            {order.shippingAddress ? (
              <>
                <p className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                </p>
                <p className="text-gray-600 text-xs sm:text-sm mb-2">
                  {order.shippingAddress.street}
                </p>
                <p className="text-gray-600 text-xs sm:text-sm mb-2">
                  {order.shippingAddress.city}, {order.shippingAddress.state}
                </p>
                {order.shippingAddress.landmark && (
                  <p className="text-gray-600 text-xs sm:text-sm mb-2">
                    Landmark: {order.shippingAddress.landmark}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{order.shippingAddress.phone}</span>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm">Address not available</p>
            )}
          </div>
        </div>

        {/* Mobile-optimized Store Groups */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Orders Sent To:</h2>
          <div className="space-y-3 sm:space-y-4">
            {order.stores?.map((storeGroup, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                      {storeGroup.storeName}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      {storeGroup.itemCount} {storeGroup.itemCount === 1 ? 'item' : 'items'}
                    </p>
                    
                    {/* Mobile: Smaller social media indicators */}
                    {storeGroup.storeSnapshot?.onlineStoreInfo?.socialMedia && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">Available on:</span>
                        <div className="flex gap-1">
                          {Object.entries(storeGroup.storeSnapshot.onlineStoreInfo.socialMedia)
                            .filter(([platform, handle]) => handle && handle.trim() !== '')
                            .slice(0, 3)
                            .map(([platform]) => (
                              <div key={platform} className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-gray-200 flex items-center justify-center">
                                <span className="text-[6px] sm:text-[8px] font-bold text-gray-600">
                                  {platform.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            ))}
                          {Object.values(storeGroup.storeSnapshot.onlineStoreInfo.socialMedia)
                            .filter(handle => handle && handle.trim() !== '').length > 3 && (
                            <span className="text-xs text-gray-400">+more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Mobile: Stacked layout for price and actions */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 sm:gap-2">
                    <div className="text-left sm:text-right">
                      <p className="text-base sm:text-lg font-bold text-gray-900">
                        {formatPrice(storeGroup.subtotal)}
                      </p>
                      <span className={`inline-block mt-1 px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(storeGroup.status)}`}>
                        {storeGroup.status}
                      </span>
                    </div>
                    
                    {/* Mobile: Smaller button */}
                    <button
                      onClick={() => handleMessageVendor(storeGroup)}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-xs sm:text-sm flex-shrink-0"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>Message</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile-optimized Order Items */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Order Items</h2>
          <div className="space-y-3 sm:space-y-4">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-100 rounded-lg sm:rounded-xl">
                {/* Mobile: Smaller image */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {item.productSnapshot?.image ? (
                    <img 
                      src={item.productSnapshot.image} 
                      alt={item.productSnapshot.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl sm:text-2xl">
                      📦
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                    {item.productSnapshot?.productName}
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-500 mb-2">
                    Quantity: {item.quantity} × {formatPrice(item.price)}
                  </p>
                  <p className="text-base sm:text-lg font-bold text-gray-900">
                    {formatPrice(item.subtotal)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile-optimized Order Summary */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Order Summary</h2>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between text-gray-600 text-sm sm:text-base">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-gray-600 text-sm sm:text-base">
                <span>Discount</span>
                <span className="font-semibold text-red-600">-{formatPrice(order.discount)}</span>
              </div>
            )}
            {order.shippingFee > 0 && (
              <div className="flex justify-between text-gray-600 text-sm sm:text-base">
                <span>Shipping Fee</span>
                <span className="font-semibold text-gray-900">{formatPrice(order.shippingFee)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 sm:pt-3 flex justify-between">
              <span className="text-base sm:text-lg font-bold text-gray-900">Total</span>
              <span className="text-xl sm:text-2xl font-bold" style={{ color: primaryColor }}>
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile-optimized Payment Information */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Payment Information</h3>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Payment Method</p>
              <p className="text-sm sm:text-base font-medium text-gray-900">
                {order.payment?.method ? order.payment.method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Cash to Vendor'}
              </p>
            </div>
            {order.payment?.transactionId && (
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Transaction ID</p>
                <p className="text-sm sm:text-base font-medium text-gray-900 break-all">{order.payment.transactionId}</p>
              </div>
            )}
            {order.payment?.reference && (
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Payment Reference</p>
                <p className="text-sm sm:text-base font-medium text-gray-900 break-all">{order.payment.reference}</p>
              </div>
            )}
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Payment Status</p>
              <p className="text-sm sm:text-base font-medium text-gray-900">
                {order.payment?.status ?
                  order.payment.status.charAt(0).toUpperCase() + order.payment.status.slice(1) :
                  'Pending'
                }
              </p>
            </div>
          </div>

          {canPayNow && (
            <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-100">
              {payNowError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-sm">{payNowError}</p>
                </div>
              )}
              <button
                onClick={handlePayNow}
                disabled={isPayingNow}
                className="w-full py-3 sm:py-4 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                style={{ backgroundColor: primaryColor }}
              >
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                {isPayingNow ? "Starting payment..." : "Complete Payment"}
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                This order is still waiting on payment. Complete it now to confirm your order.
              </p>
            </div>
          )}
        </div>

        {/* Mobile-optimized Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <button
            onClick={() => router.push(`/${resolvedParams.slug}`)}
            className="flex-1 py-3 sm:py-4 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            Back to Store
          </button>
          
          {/* Contact All Vendors Button - Mobile: full width if multiple stores */}
          {order.stores?.length > 1 && (
            <button
              onClick={handleContactAllVendors}
              className="flex-1 py-3 sm:py-4 text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
              style={{ backgroundColor: '#25D366' }}
            >
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Contact All Vendors</span>
              <span className="sm:hidden">Contact All</span>
            </button>
          )}
          
          <button
            onClick={() => router.push(`/${resolvedParams.slug}/orders`)}
            className="flex-1 py-3 sm:py-4 text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">View All Orders</span>
            <span className="sm:hidden">All Orders</span>
          </button>
        </div>

        {/* Mobile-optimized Additional Info */}
        <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-xs sm:text-sm text-blue-800">
            <strong>Note:</strong> You will receive order confirmations via WhatsApp from each store. 
            If you have any questions about your order, please contact the respective store directly using the message buttons above.
          </p>
        </div>
      </div>

      {/* WhatsApp Contact Modal for Multiple Vendors */}
      <WhatsAppContactModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        order={order}
        primaryColor={primaryColor}
        formatPrice={formatPrice}
        openWhatsApp={openWhatsApp}
      />

      {/* Store Socials Modal for Individual Vendor */}
      <StoreSocialsModal
        isOpen={showStoreSocialsModal}
        onClose={() => {
          setShowStoreSocialsModal(false);
          setSelectedStore(null);
        }}
        store={selectedStore}
        orderNumber={order?.orderNumber}
        customerName={`${customer?.firstName || ''} ${customer?.lastName || ''}`.trim()}
        itemCount={selectedStore?.itemCount}
        primaryColor={primaryColor}
        formatPrice={formatPrice}
      />
    </div>
  );
}
