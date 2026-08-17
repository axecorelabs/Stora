"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Package, ShoppingBag, ArrowLeft, MapPin, Phone, Calendar, MessageCircle, AlertCircle, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import WhatsAppContactModal from "@/components/orders/WhatsAppContactModal";
import StoreSocialsModal from "@/components/orders/StoreSocialsModal";

// Shared by both /orders/[id] (no vendor in context) and
// /[slug]/orders/[id] (reached while browsing one vendor's store) -- same
// reasoning as components/cart/CartPageContent.js: an order can span
// multiple vendors either way, so this never borrows one vendor's identity
// for navigation or color, and slug is purely optional context for
// building a "back to that store" link when it's genuinely available.
const BRAND_PRIMARY = "#145C41";

export default function OrderDetailsPageContent({ slug, orderId }) {
  const router = useRouter();
  const { customer } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  // The auto-popup (order.contactOnlyStores -- "these sellers can't be paid
  // online") and the manual "Contact all vendors" button (order.stores --
  // every vendor on the order, payment status aside) share the same modal
  // instance, so which store list it shows depends on which one opened it.
  const [whatsAppModalContactOnly, setWhatsAppModalContactOnly] = useState(true);
  const [showStoreSocialsModal, setShowStoreSocialsModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [isPayingNow, setIsPayingNow] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [payNowError, setPayNowError] = useState(null);

  const homeHref = slug ? `/${slug}` : "/";
  const ordersListHref = slug ? `/${slug}/orders` : "/orders";
  const selfHref = slug ? `/${slug}/orders/${orderId}` : `/orders/${orderId}`;

  // Extracted so the payment-retry flow below can re-fetch the order (to
  // pick up the new payment/order status) without a full page reload.
  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}`, {
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
  }, [orderId]);

  // Fetch order data
  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId, fetchOrder]);

  // Paystack redirects back here with ?reference= (and ?trxref=) once the
  // customer finishes on its hosted checkout page -- the redirect-flow
  // counterpart to the old embedded popup's onSuccess callback. Same as
  // that, it's never trusted as proof of payment by itself: it only
  // triggers the same server-side /api/payments/verify call the webhook
  // path also feeds into. Runs once on mount (this page load *is* the
  // return from Paystack, if it's happening at all); the query params are
  // stripped immediately so a later refresh doesn't re-verify.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reference = new URLSearchParams(window.location.search).get("reference");
    if (!reference) return;

    window.history.replaceState({}, "", window.location.pathname);

    (async () => {
      setIsConfirmingPayment(true);
      try {
        const verifyRes = await fetch(
          `/api/payments/verify?reference=${encodeURIComponent(reference)}`,
          { credentials: "include" }
        );
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          setPayNowError(verifyData.message || "Payment could not be confirmed");
        }
        await fetchOrder();
      } catch (error) {
        console.error("Error verifying payment:", error);
        setPayNowError("Payment could not be confirmed. Please contact support.");
      } finally {
        setIsConfirmingPayment(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show WhatsApp modal for pending orders -- only when there's actually a
  // store with no online payment covering it. A store mid-payment on the
  // order's one combined Paystack charge isn't "contact-only" just because
  // the order as a whole is still 'pending'.
  useEffect(() => {
    if (order && order.status === 'pending' && order.contactOnlyStores?.length > 0) {
      const timer = setTimeout(() => {
        setWhatsAppModalContactOnly(true);
        setShowWhatsAppModal(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [order]);

  const currency = 'NGN';

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
    if (!storePhone) {
      alert(`Sorry, ${storeName} doesn't have a WhatsApp number available.`);
      return;
    }

    const cleanPhone = storePhone.replace(/\s/g, '').replace(/^0/, '234');
    const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;

    const customerName = `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
    const message = formatWhatsAppMessage(storeName, order?.orderNumber, customerName, itemCount);

    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;

    const newWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
      window.location.href = whatsappUrl;
    }
  };

  const handleMessageVendor = (storeGroup) => {
    setSelectedStore(storeGroup);
    setShowStoreSocialsModal(true);
  };

  const handleContactAllVendors = () => {
    setWhatsAppModalContactOnly(false);
    setShowWhatsAppModal(true);
  };

  const formatPrice = (price) => {
    if (currency === 'NGN') {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
  };

  const canPayNow = order?.payment?.method === 'paystack'
    && order?.payment?.status !== 'completed'
    && !['cancelled', 'refunded'].includes(order?.status);

  // Fills the gap this order page always had: there was no way to resume
  // payment on an order once the cart (and the checkout modal that
  // triggers Paystack) was gone -- a failed init call or any other
  // interruption left the order permanently unpaid with no path forward
  // except re-shopping from scratch. Hands off to Paystack's own hosted
  // checkout page, which redirects back here (see the ?reference= effect
  // above) once the customer's done.
  const handlePayNow = async () => {
    setPayNowError(null);
    setIsPayingNow(true);

    try {
      setIsConfirmingPayment(true);
      const initRes = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId: order.id,
          returnPath: selfHref,
        }),
      });
      const initData = await initRes.json();

      if (!initRes.ok || !initData.success) {
        setPayNowError(initData.message || "Could not start payment");
        setIsConfirmingPayment(false);
        setIsPayingNow(false);
        return;
      }

      if (initData.alreadyPaid) {
        await fetchOrder();
        setIsConfirmingPayment(false);
        setIsPayingNow(false);
        return;
      }

      window.location.href = initData.authorizationUrl;
    } catch (error) {
      console.error("Error starting payment:", error);
      setPayNowError("Could not start payment. Please try again.");
      setIsConfirmingPayment(false);
      setIsPayingNow(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50/40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-brand-100 border-t-brand-700 mb-4 mx-auto"></div>
          <p className="text-brand-800/60 text-sm">Loading order details…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50/40 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" strokeWidth={1.5} />
          </div>
          <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">{error || 'Order not found'}</h2>
          <p className="text-sm text-gray-500 mb-6">
            We couldn&apos;t find the order you&apos;re looking for.
          </p>
          <button
            onClick={() => router.push(homeHref)}
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl text-sm font-semibold bg-brand-700 hover:bg-brand-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 lg:py-12">
      {isConfirmingPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-900/50 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl px-7 py-6 flex items-center gap-3.5 shadow-xl shadow-brand-900/20">
            <div className="w-5 h-5 border-[2.5px] border-brand-100 border-t-brand-700 rounded-full animate-spin" />
            <span className="text-sm font-medium text-brand-900">Confirming payment…</span>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Success Header -- Stora chrome: the order this page describes can
            span several vendors (see Store Groups below), so this doesn't
            tint by whichever single store's color happens to be loaded. */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 bg-brand-100">
            <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-brand-700" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-gray-900 mb-2">
            Order details
          </h1>
          <p className="text-gray-500 text-base sm:text-lg px-4">
            Thank you for shopping with Stora
          </p>
        </div>

        {/* Mobile-optimized Order Number & Status Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4 mb-4">
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Order number</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{order.orderNumber}</p>
            </div>
            <div className="flex justify-center sm:justify-end">
              <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold text-xs sm:text-sm ${getStatusColor(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Order date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Total items</p>
                <p className="text-sm font-medium text-gray-900 tabular-nums">{order.itemCount} items</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Total amount</p>
                <p className="text-base sm:text-lg font-bold text-brand-800 tabular-nums">
                  {formatPrice(order.totalAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
            Delivery address
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
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Sent to</h2>
          <div className="space-y-3 sm:space-y-4">
            {order.stores?.map((storeGroup) => (
              <div key={storeGroup.storeId} className="border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:shadow-sm transition-shadow">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                      {storeGroup.storeName}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      {storeGroup.itemCount} {storeGroup.itemCount === 1 ? 'item' : 'items'}
                    </p>

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

                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 sm:gap-2">
                    <div className="text-left sm:text-right">
                      <p className="text-base sm:text-lg font-bold text-gray-900">
                        {formatPrice(storeGroup.subtotal)}
                      </p>
                      <span className={`inline-block mt-1 px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(storeGroup.status)}`}>
                        {storeGroup.status}
                      </span>
                    </div>

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
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Order items</h2>
          <div className="space-y-3 sm:space-y-4">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-100 rounded-lg sm:rounded-xl">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {item.productSnapshot?.image ? (
                    <img
                      src={item.productSnapshot.image}
                      alt={item.productSnapshot.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 sm:w-7 sm:h-7 text-gray-300" strokeWidth={1.5} />
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

        {/* Order Summary -- ledger-receipt treatment, matching checkout */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Order summary</h2>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between text-gray-600 text-sm sm:text-base">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900 tabular-nums">{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-gray-600 text-sm sm:text-base">
                <span>Discount</span>
                <span className="font-semibold text-red-600 tabular-nums">-{formatPrice(order.discount)}</span>
              </div>
            )}
            {order.shippingFee > 0 && (
              <div className="flex justify-between text-gray-600 text-sm sm:text-base">
                <span>Shipping fee</span>
                <span className="font-semibold text-gray-900 tabular-nums">{formatPrice(order.shippingFee)}</span>
              </div>
            )}
            <div className="border-t border-dashed border-gray-200 pt-2 sm:pt-3 flex justify-between">
              <span className="text-base sm:text-lg font-bold text-gray-900">Total</span>
              <span className="text-xl sm:text-2xl font-bold text-brand-800 tabular-nums">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Payment information</h3>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Payment method</p>
              <p className="text-sm sm:text-base font-medium text-gray-900">
                {order.payment?.method ? order.payment.method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Cash to vendor'}
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
                <p className="text-xs sm:text-sm text-gray-500">Payment reference</p>
                <p className="text-sm sm:text-base font-medium text-gray-900 break-all">{order.payment.reference}</p>
              </div>
            )}
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Payment status</p>
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
                className="w-full py-3 sm:py-4 text-white rounded-xl font-semibold bg-brand-700 hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                {isPayingNow ? "Starting payment…" : "Complete payment"}
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                This order is still waiting on payment. Complete it now to confirm your order.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <button
            onClick={() => router.push(homeHref)}
            className="flex-1 py-3 sm:py-4 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            {slug ? "Back to store" : "Go home"}
          </button>

          {order.stores?.length > 1 && (
            <button
              onClick={handleContactAllVendors}
              className="flex-1 py-3 sm:py-4 text-white rounded-xl font-semibold hover:brightness-95 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
              style={{ backgroundColor: '#25D366' }}
            >
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Contact all vendors</span>
              <span className="sm:hidden">Contact all</span>
            </button>
          )}

          <button
            onClick={() => router.push(ordersListHref)}
            className="flex-1 py-3 sm:py-4 text-white rounded-xl font-semibold bg-brand-700 hover:bg-brand-800 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">View all orders</span>
            <span className="sm:hidden">All orders</span>
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-gold-400/10 border border-gold-500/25 rounded-xl">
          <p className="text-xs sm:text-sm text-brand-900/80">
            <strong className="text-gold-700">Note:</strong> You&apos;ll receive order confirmations via WhatsApp from each store.
            If you have any questions about your order, please contact the respective store directly using the message buttons above.
          </p>
        </div>
      </div>

      {/* WhatsApp Contact Modal -- the auto-popup scopes to stores with no
          online payment covering them (order.contactOnlyStores, see
          findOrderById); the manual "Contact all vendors" button below
          shows every vendor on the order regardless of payment status. */}
      <WhatsAppContactModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        order={order ? { ...order, stores: whatsAppModalContactOnly ? order.contactOnlyStores : order.stores } : order}
        contactOnly={whatsAppModalContactOnly}
        formatPrice={formatPrice}
        openWhatsApp={openWhatsApp}
      />

      {/* Store Socials Modal for Individual Vendor -- this one IS about one
          specific vendor, so it's fine (correct, even) for it to use that
          vendor's own color when available, rather than Stora's. */}
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
        primaryColor={selectedStore?.storeSnapshot?.branding?.primaryColor || BRAND_PRIMARY}
        formatPrice={formatPrice}
      />
    </div>
  );
}
