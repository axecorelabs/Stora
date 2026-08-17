"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  Tag,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Store,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import WhatsAppContactModal from "@/components/orders/WhatsAppContactModal";
import OrderModal from "@/components/cart/OrderModal";

// Shared by both /cart (no vendor in context -- e.g. the homepage header's
// cart icon) and /[slug]/cart (reached while browsing one vendor's store).
// slug is nullable on purpose: this cart can span multiple vendors either
// way, so every navigation target here is Stora's own chrome/URLs, never
// borrowed from whichever vendor happens to be first in the cart -- taking
// someone to a specific vendor's URL space just to view a cross-vendor
// cart broke the back button (it "returned" into that vendor's storefront
// instead of wherever the customer actually came from) and effectively
// gave that vendor free, arbitrary exposure. Item/price colors are Stora's
// brand chrome uniformly for the same reason -- a store group's own color
// isn't reliably available here (cart_items' store_snapshot never carried
// branding), and even where it happened to be, borrowing ONE vendor's
// color for the whole page was never correct for a cart holding several.
const BRAND_PRIMARY = "#145C41";
const BRAND_LIGHT = "#EAF1EE";

export default function CartPageContent({ slug }) {
  const router = useRouter();
  const { isAuthenticated, customer } = useAuth();
  const {
    cart,
    isLoading,
    removeFromCart,
    updateQuantity,
    getCartTotal,
    getCartCount,
    refreshCart,
  } = useCart();

  const homeHref = slug ? `/${slug}` : "/";
  const orderHref = (orderId) => (slug ? `/${slug}/orders/${orderId}` : `/orders/${orderId}`);

  // Cart functionality state
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [orderError, setOrderError] = useState(null);

  // New state for WhatsApp contact modal
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [orderStores, setOrderStores] = useState([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [redirectingToWhatsApp, setRedirectingToWhatsApp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Per-store checkout state
  const [showStoreOrderModal, setShowStoreOrderModal] = useState(false);
  const [selectedStoreGroup, setSelectedStoreGroup] = useState(null);

  // Set when an order needs both a WhatsApp handoff (for stores with no
  // Paystack subaccount) and an online payment (for stores that do) -- the
  // WhatsApp modal is shown first since it's just UI state, and the
  // redirect to Paystack (which navigates away entirely) is deferred until
  // it closes, see handleWhatsAppModalClose.
  const [pendingPaymentOrderId, setPendingPaymentOrderId] = useState(null);

  // Screen size detection
  useEffect(() => {
    const detectScreenSize = () => {
      if (typeof window !== "undefined") {
        return window.innerWidth < 768;
      }
      return false;
    };

    const handleResize = () => {
      setIsMobile(detectScreenSize());
    };

    setIsMobile(detectScreenSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(homeHref);
    }
  }, [isAuthenticated, isLoading, router, homeHref]);

  const currency = "NGN";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50/40">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-[3px] border-brand-100 border-t-brand-700 mb-4"></div>
          <p className="text-brand-800/70 text-sm font-medium">Loading your cart…</p>
        </div>
      </div>
    );
  }

  if (!cart || cart.items?.length === 0) {
    return (
      <div className="min-h-screen bg-brand-50/40">
        {/* Header */}
        <div className="bg-white border-b border-brand-100/70">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
            <button
              onClick={() => router.push(homeHref)}
              className="flex items-center gap-2 text-brand-800/70 hover:text-brand-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium text-sm">Continue Shopping</span>
            </button>
          </div>
        </div>

        {/* Empty Cart -- Stora chrome, not vendor-colored: this is the
            platform speaking, not a specific seller's product content. */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center max-w-sm mx-auto">
            <div className="w-20 h-20 mx-auto mb-7 rounded-2xl bg-brand-100/70 flex items-center justify-center">
              <ShoppingBag className="w-9 h-9 text-brand-700" strokeWidth={1.5} />
            </div>
            <h2 className="font-display text-2xl md:text-[28px] font-semibold text-brand-900 mb-2.5 tracking-tight">
              Your cart is empty
            </h2>
            <p className="text-brand-800/60 text-[15px] leading-relaxed mb-8">
              Nothing here yet — find something you like and it&apos;ll show up in this cart.
            </p>
            <button
              onClick={() => router.push(homeHref)}
              className="inline-flex items-center gap-2 px-7 py-3.5 text-white rounded-xl font-semibold text-sm bg-brand-700 hover:bg-brand-800 transition-colors shadow-sm shadow-brand-900/10"
            >
              Start shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatPrice = (price) => {
    if (currency === "NGN") {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
  };

  const toggleItemExpansion = (itemId) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const getItemImage = (item) => {
    // Priority: variant image > product_data (enriched fresh data) > product_snapshot > images array
    if (item.variant?.image) {
      return item.variant.image;
    }
    if (item.product_data?.primary_image) {
      return item.product_data.primary_image;
    }
    if (item.product_snapshot?.primary_image) {
      return item.product_snapshot.primary_image;
    }
    // Fallback to first image in images array
    if (item.product_snapshot?.images && item.product_snapshot.images.length > 0) {
      return item.product_snapshot.images[0];
    }
    return null;
  };

  const hasExtraDetails = (item) => {
    return item.variant || item.notes;
  };

  const handleQuantityChange = async (productId, newQuantity) => {
    if (newQuantity < 1) return;

    setUpdatingItemId(productId);
    await updateQuantity(productId, newQuantity);
    setUpdatingItemId(null);
  };

  const handleRemoveItem = async (productId) => {
    if (confirm("Are you sure you want to remove this item from your cart?")) {
      await removeFromCart(productId);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setIsApplyingCoupon(true);
    setTimeout(() => {
      setIsApplyingCoupon(false);
      alert("Coupon functionality coming soon!");
    }, 1000);
  };

  // OrderModal owns its own form state (including WhatsApp validation) and
  // resets it fresh on every mount -- this just needs to open it.
  const handlePlaceOrder = () => {
    setShowOrderModal(true);
    setOrderError(null);
  };

  const formatWhatsAppMessage = (
    storeName,
    orderNumber,
    customerName,
    itemCount
  ) => {
    return encodeURIComponent(
      `Hi ${storeName}! 👋\n\n` +
        `I just placed an order through your Stora store:\n` +
        `Order #${orderNumber}\n` +
        `Customer: ${customerName}\n` +
        `Items: ${itemCount}\n\n` +
        `Please confirm my order and let me know the estimated delivery time. Thank you! 😊`
    );
  };

  const openWhatsApp = (storePhone, storeName, itemCount) => {
    if (!storePhone) {
      alert(`Sorry, ${storeName} doesn't have a WhatsApp number available.`);
      return;
    }

    // Clean and format phone number
    const cleanPhone = storePhone.replace(/\s/g, "").replace(/^0/, "234");
    const formattedPhone = cleanPhone.startsWith("+")
      ? cleanPhone.substring(1)
      : cleanPhone;

    const customerName = `${customer?.firstName || ""} ${
      customer?.lastName || ""
    }`.trim();
    const message = formatWhatsAppMessage(
      storeName,
      orderNumber,
      customerName,
      itemCount
    );

    // Open WhatsApp
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  // Shared by both checkout flows below. Hands off to Paystack's own hosted
  // checkout page rather than an embedded popup -- it owns the entire
  // payment UI from here, including waiting out a slow channel like bank
  // transfer, natively, without us reinventing a client-side timer for it.
  // Paystack redirects back to returnPath with ?reference= once the
  // customer's done; the order page picks that up and calls
  // /api/payments/verify (same idempotent core the webhook uses) -- the
  // redirect itself is never trusted as proof of payment.
  const triggerPaystackPayment = async (orderId) => {
    setIsConfirmingPayment(true);
    try {
      const initRes = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId,
          returnPath: orderHref(orderId),
        }),
      });
      const initData = await initRes.json();

      if (!initRes.ok || !initData.success) {
        setOrderError(initData.message || "Could not start payment");
        setIsConfirmingPayment(false);
        return { success: false };
      }

      // A previous attempt for this order already succeeded on Paystack's
      // side -- initiate found and confirmed it instead of starting a new
      // charge. Nothing to redirect to.
      if (initData.alreadyPaid) {
        setIsConfirmingPayment(false);
        return { success: true };
      }

      window.location.href = initData.authorizationUrl;
      // The browser is navigating away -- nothing after this runs, so
      // never resolve rather than momentarily reporting a false failure.
      return new Promise(() => {});
    } catch (error) {
      console.error("Error starting payment:", error);
      setOrderError("Could not start payment. Please try again.");
      setIsConfirmingPayment(false);
      return { success: false };
    }
  };

  // Wraps orders/create's error body into a real Error, carrying
  // existingOrderId through when present -- the duplicate-checkout guard
  // returns it specifically so the customer can be sent straight to the
  // order that's actually blocking them (see OrderModal's submitError
  // handling) instead of just reading an order number in plain text with
  // no way to act on it.
  const orderCreateError = (data) => {
    const err = new Error(data.message || "Failed to place order");
    if (data.existingOrderId) err.existingOrderId = data.existingOrderId;
    return err;
  };

  // Whole-cart checkout, now routed through the same OrderModal component
  // as per-store checkout (handleStoreConfirmOrder below) instead of a
  // second, near-identical form living inline in this file -- formData is
  // OrderModal's own validated state, same shape both callers receive.
  const handleConfirmOrder = async (formData) => {
    setOrderError(null);

    const response = await fetch("/api/orders/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        cartId: cart._id,
        shippingAddress: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          street: formData.street,
          city: formData.city,
          state: formData.state,
          country: "Nigeria",
          landmark: formData.landmark || "",
        },
        customerNotes: "",
        paymentMethod: "paystack",
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Cart clearing now happens server-side in orders/create, scoped
      // to what's actually settled (contact-only items now, paid items
      // only once payment confirms) -- a blanket clearCart() call here
      // would wipe out items still awaiting payment before they'd even
      // had a chance to be charged.
      await refreshCart();
      setShowOrderModal(false);

      if (data.paymentSplitError) {
        setOrderError(data.paymentSplitError);
      }

      // Vendors with no Paystack subaccount yet get the WhatsApp-contact
      // fallback, scoped to just their items. Shown first -- before any
      // payment redirect -- since it's just UI state, not a navigation;
      // redirecting to Paystack immediately would yank the customer away
      // before they ever saw it. If this order also needs online payment
      // (other stores in the same cart that do have a subaccount), that's
      // deferred until this modal closes, see handleWhatsAppModalClose.
      const contactOnlyStores = data.contactOnlyStores || [];
      if (contactOnlyStores.length > 0) {
        setOrderNumber(data.order.orderNumber);
        setOrderStores(contactOnlyStores);
        setPendingPaymentOrderId(data.paymentRequired ? data.order.id : null);
        setShowWhatsAppModal(true);
        return;
      }

      // Real Paystack payment for whichever vendors in this cart have a
      // subaccount configured -- if none do (or paymentMethod wasn't
      // paystack at all), paymentRequired is false and this is a no-op.
      if (data.paymentRequired) {
        const paymentResult = await triggerPaystackPayment(data.order.id);
        if (!paymentResult.success) {
          router.push(orderHref(data.order.id));
        }
        return;
      }

      router.push(orderHref(data.order.id));
    } else {
      throw orderCreateError(data);
    }
  };

  const handleWhatsAppModalClose = () => {
    setShowWhatsAppModal(false);

    // This order also had a store needing online payment -- proceed to
    // that now that the customer has seen the WhatsApp handoff, rather
    // than redirecting them away before they ever saw it.
    if (pendingPaymentOrderId) {
      const orderId = pendingPaymentOrderId;
      setPendingPaymentOrderId(null);
      triggerPaystackPayment(orderId).then((result) => {
        if (!result.success) {
          router.push(orderHref(orderId));
        }
      });
      return;
    }

    // Navigate to order details after closing modal
    if (orderNumber) {
      router.push(slug ? `/${slug}/orders` : "/orders");
    }
  };

  // Group items by store
  const itemsByStore =
    cart.items?.reduce((acc, item) => {
      const storeId = item.store_id;
      if (!acc[storeId]) {
        acc[storeId] = {
          store_id: item.store_id,
          storeSnapshot: item.store_snapshot,
          items: [],
        };
      }
      acc[storeId].items.push(item);
      return acc;
    }, {}) || {};

  const storeGroups = Object.values(itemsByStore);

  // Per-store order handlers - simplified
  const handleStorePlaceOrder = (storeGroup) => {
    setSelectedStoreGroup(storeGroup);
    setShowStoreOrderModal(true);
  };

  const handleStoreConfirmOrder = async (formData) => {
    // A stale error from a previous attempt (rendered by the page-level
    // toast above, since OrderModal closes before payment is attempted)
    // must not persist into this one.
    setOrderError(null);
    try {
      const itemIds = selectedStoreGroup.items.map((item) => item.id);
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cartId: cart.id,
          itemIds,
          shippingAddress: {
            // Use formData which already has the customer name from OrderModal
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            street: formData.street,
            city: formData.city,
            state: formData.state,
            country: "Nigeria",
            landmark: formData.landmark || "",
          },
          customerNotes: "",
          paymentMethod: "paystack",
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // See handleConfirmOrder's identical comment -- cart clearing is
        // server-side and payment-status-aware now, not a blanket call
        // from here.
        await refreshCart();
        setShowStoreOrderModal(false);
        setSelectedStoreGroup(null);

        // Vendor with no Paystack subaccount yet -- same WhatsApp-contact
        // fallback as handleConfirmOrder, shown before any payment redirect
        // so it's never skipped by the browser navigating away first.
        const contactOnlyStores = data.contactOnlyStores || [];
        if (contactOnlyStores.length > 0) {
          setOrderNumber(data.order.orderNumber);
          setOrderStores(contactOnlyStores);
          setPendingPaymentOrderId(data.paymentRequired ? data.order.id : null);
          setShowWhatsAppModal(true);
          return;
        }

        // A cancelled/failed payment leaves the order exactly as created
        // (unpaid, reservation intact) -- close this modal rather than
        // throw (OrderModal's error UI is meant for checkout-creation
        // failures, not a user backing out of paying), then send them to
        // the order page's "Pay Now" retry instead of leaving them on the
        // now-emptied cart with no path forward.
        if (data.paymentRequired) {
          const paymentResult = await triggerPaystackPayment(data.order.id);
          if (!paymentResult.success) {
            router.push(orderHref(data.order.id));
          }
          return;
        }

        router.push(orderHref(data.order.id));
      } else {
        throw orderCreateError(data);
      }
    } catch (error) {
      console.error("Error placing order:", error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isConfirmingPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-900/50 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl px-7 py-6 flex items-center gap-3.5 shadow-xl shadow-brand-900/20">
            <div className="w-5 h-5 border-[2.5px] border-brand-100 border-t-brand-700 rounded-full animate-spin" />
            <span className="text-sm font-medium text-brand-900">Taking you to secure checkout…</span>
          </div>
        </div>
      )}

      {/* Page-level fallback for payment-stage errors (triggerPaystackPayment's
          setOrderError calls) -- the per-store checkout flow (OrderModal)
          closes as soon as the order is created, before payment is even
          attempted, so a failure inside triggerPaystackPayment had nowhere
          left to render: the whole-cart modal's inline error display below
          is gated on showOrderModal, which is never true on that path.
          Guarded on !showOrderModal so the two displays don't double up
          when the whole-cart flow is the one that set this. */}
      {orderError && !showOrderModal && (
        <div className="fixed top-4 inset-x-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-md z-[70]">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 shadow-lg shadow-black/5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{orderError}</p>
          </div>
        </div>
      )}

      {/* Header - Mobile Optimized */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(homeHref)}
                className="flex items-center gap-1 md:gap-2 text-gray-500 hover:text-brand-800 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium text-sm md:text-base truncate max-w-[120px] md:max-w-none">
                  Home
                </span>
              </button>
              {!isMobile && (
                <>
                  <span className="text-gray-300">›</span>
                  <span className="font-medium text-gray-900">Cart</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 text-brand-800">
              <ShoppingBag className="w-4 h-4 md:w-5 md:h-5" />
              <span className="font-semibold text-sm md:text-base tabular-nums">
                {getCartCount()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile Optimized */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-10">
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-brand-600 mb-1.5">Checkout</p>
        <h1 className="font-display text-[26px] md:text-[34px] font-semibold text-brand-900 tracking-tight mb-6 md:mb-9">
          Your cart
        </h1>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
          {/* Cart Items - Enhanced with Expandable Details */}
          <div className="lg:col-span-2 space-y-3 md:space-y-6">
            {storeGroups.map((storeGroup, idx) => (
              <div
                key={idx}
                className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col shadow-[0_1px_2px_rgba(11,59,46,0.04)]"
              >
                {/* Store Header -- a 3px accent rule in Stora's own brand
                    color, not a borrowed vendor color (see the file-level
                    note on BRAND_PRIMARY for why). */}
                {storeGroup.storeSnapshot && (
                  <div
                    className="px-4 md:px-6 py-2.5 md:py-3 border-b border-gray-100 border-l-[3px] flex items-center gap-2"
                    style={{ borderLeftColor: BRAND_PRIMARY }}
                  >
                    <Store className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <p className="font-medium text-gray-700 text-xs md:text-sm truncate">
                      {storeGroup.storeSnapshot.store_name || storeGroup.storeSnapshot.storeName}
                    </p>
                  </div>
                )}

                <div className="divide-y divide-gray-100">
                  {storeGroup.items.map((item) => {
                    const itemId = item.id;
                    const isExpanded = expandedItems.has(itemId);
                    const showExpandButton = hasExtraDetails(item);
                    const itemImage = getItemImage(item);

                    return (
                      <div key={itemId} className="p-3 md:p-6 relative">
                        {/* Payment-pending banner -- this item is already
                            tied to a real order awaiting payment (see the
                            duplicate-checkout guard in orders/create/route.js);
                            surfacing that here, before they even attempt to
                            check out again, beats letting them fill out the
                            whole modal only to hit a 409 with no obvious next
                            step. pending_order_id is reliably cleared back to
                            null once that order resolves (paid, cancelled, or
                            caught by the abandoned-payment cron), so this
                            never goes stale. */}
                        {item.pending_order_id && (
                          <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg bg-gold-400/10 border border-gold-500/25">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-gold-700">
                              <Clock className="w-3.5 h-3.5" />
                              Payment pending
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(orderHref(item.pending_order_id));
                              }}
                              className="text-xs font-semibold text-gold-700 hover:underline"
                            >
                              Resume payment
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2 md:gap-4">
                          {/* Product Image - Now uses variant image if available */}
                          <div className="flex-shrink-0">
                            <div
                              className={`${
                                isMobile ? "w-20 h-20" : "w-32 h-32"
                              } rounded-xl overflow-hidden relative bg-gray-50 border border-gray-100`}
                            >
                              {itemImage ? (
                                <img
                                  src={itemImage}
                                  alt={item.product_snapshot?.product_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingBag className={`${isMobile ? "w-6 h-6" : "w-9 h-9"} text-gray-300`} strokeWidth={1.5} />
                                </div>
                              )}
                              {/* Variant Badge */}
                              {item.variant && (
                                <div className="absolute bottom-1 left-1 right-1 bg-brand-900/75 backdrop-blur-sm text-white text-[10px] font-medium text-center py-0.5 px-1 rounded-md">
                                  Custom
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1 md:mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-0.5 md:mb-1 line-clamp-2">
                                  {item.product_snapshot?.product_name}
                                </h3>
                                {item.product_snapshot?.category && (
                                  <p className="text-xs md:text-sm text-gray-500">
                                    {item.product_snapshot.category}
                                  </p>
                                )}
                                {/* Variant Info - Quick Preview */}
                                {item.variant && !isExpanded && (
                                  <div className="flex items-center gap-2 mt-1">
                                    {item.variant.color && (
                                      <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md">
                                        {item.variant.color}
                                      </span>
                                    )}
                                    {item.variant.size && (
                                      <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md">
                                        {item.variant.size}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {!isMobile && item.product_snapshot?.sku && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    SKU: {item.product_snapshot.sku}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  handleRemoveItem(
                                    item.product_id
                                  )
                                }
                                className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                              </button>
                            </div>

                            <p
                              className="text-lg md:text-2xl font-bold mb-2 md:mb-4 tabular-nums"
                              style={{ color: BRAND_PRIMARY }}
                            >
                              {formatPrice(item.price)}
                            </p>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2 md:gap-4">
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                <button
                                  onClick={() =>
                                    handleQuantityChange(
                                      item.product_id,
                                      item.quantity - 1
                                    )
                                  }
                                  disabled={
                                    item.quantity <= 1 ||
                                    updatingItemId === item.product_id
                                  }
                                  className="px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Minus className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-500" />
                                </button>
                                <span className="px-3 md:px-5 py-1.5 md:py-2 font-semibold text-gray-900 min-w-[40px] md:min-w-[56px] text-center text-sm md:text-base tabular-nums">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    handleQuantityChange(
                                      item.product_id,
                                      item.quantity + 1
                                    )
                                  }
                                  disabled={
                                    updatingItemId === item.product_id
                                  }
                                  className="px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Plus className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-500" />
                                </button>
                              </div>

                              {updatingItemId === item.product_id && (
                                <span className="text-xs md:text-sm text-gray-400">
                                  Updating…
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expand/Collapse Button - Positioned at bottom-right */}
                        {showExpandButton && (
                          <button
                            onClick={() => toggleItemExpansion(itemId)}
                            className="absolute bottom-3 right-3 md:bottom-6 md:right-6 flex items-center gap-1.5 text-xs md:text-sm text-gray-500 hover:text-brand-800 transition-colors bg-white px-2.5 py-1.5 rounded-lg"
                          >
                            <span className="font-medium">
                              {isExpanded ? "Hide details" : "Show details"}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            )}
                          </button>
                        )}

                        {/* Expanded Details Section */}
                        {isExpanded && showExpandButton && (
                          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                            {/* Variant Details */}
                            {item.variant && (
                              <div className="rounded-lg p-3 bg-brand-50/60 border border-brand-100/70">
                                <h4 className="text-xs font-semibold text-brand-800 uppercase tracking-wide mb-2">
                                  Variant details
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {item.variant.color && (
                                    <div>
                                      <span className="text-gray-500">
                                        Color:
                                      </span>
                                      <span className="ml-2 font-medium text-gray-900">
                                        {item.variant.color}
                                      </span>
                                    </div>
                                  )}
                                  {item.variant.size && (
                                    <div>
                                      <span className="text-gray-500">
                                        Size:
                                      </span>
                                      <span className="ml-2 font-medium text-gray-900">
                                        {item.variant.size}
                                      </span>
                                    </div>
                                  )}
                                  {item.variant.sku && (
                                    <div className="col-span-2">
                                      <span className="text-gray-500">
                                        Variant SKU:
                                      </span>
                                      <span className="ml-2 font-mono text-xs text-gray-900">
                                        {item.variant.sku}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Product Details */}
                            {item.productSnapshot && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                  Product Details
                                </h4>
                                <div className="space-y-1 text-sm">
                                  {item.product_snapshot.brand && (
                                    <div>
                                      <span className="text-gray-500">
                                        Brand:
                                      </span>
                                      <span className="ml-2 font-medium text-gray-900">
                                        {item.product_snapshot.brand}
                                      </span>
                                    </div>
                                  )}
                                  {item.product_snapshot.unit_of_measure && (
                                    <div>
                                      <span className="text-gray-500">
                                        Unit:
                                      </span>
                                      <span className="ml-2 font-medium text-gray-900">
                                        {item.product_snapshot.unit_of_measure}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {item.notes && (
                              <div className="bg-gold-400/10 border border-gold-500/30 rounded-lg p-3">
                                <h4 className="text-sm font-semibold text-gold-700 mb-1 flex items-center gap-2">
                                  <Tag className="w-4 h-4" />
                                  Notes
                                </h4>
                                <p className="text-sm text-brand-900/80">
                                  {item.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Store Footer Panel */}
                <div className="px-4 md:px-6 py-3.5 md:py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between relative z-[1]">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mb-0.5">
                      Store subtotal
                    </span>
                    <span
                      className="text-base md:text-lg font-bold tabular-nums"
                      style={{ color: BRAND_PRIMARY }}
                    >
                      {formatPrice(
                        storeGroup.items.reduce(
                          (sum, item) => sum + (item.subtotal || item.price * item.quantity),
                          0
                        )
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => handleStorePlaceOrder(storeGroup)}
                    className="px-4 py-2.5 md:px-6 md:py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 text-white text-sm md:text-base bg-brand-700 hover:bg-brand-800 shadow-sm shadow-brand-900/10"
                  >
                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                    <span>Place order</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary -- styled as a ledger receipt: the one place on
              this page that's unambiguously Stora's (money changing hands
              through the platform), so it carries the brand's own visual
              language rather than any one vendor's. */}
          <div className="lg:col-span-1">
            <div
              className={`bg-white rounded-2xl border border-gray-100 overflow-hidden ${
                !isMobile && "sticky top-24"
              }`}
            >
              <div className="h-1 bg-gradient-to-r from-brand-700 via-brand-600 to-gold-500" />
              <div className="p-5 md:p-6">
                <h2 className="font-display text-lg md:text-xl font-semibold text-brand-900 mb-5">
                  Order summary
                </h2>

                <div className="space-y-3 md:space-y-3.5 mb-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Subtotal
                    </span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {formatPrice(cart.subtotal || 0)}
                    </span>
                  </div>

                  {cart.discount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        Discount
                      </span>
                      <span className="font-medium text-red-600 tabular-nums">
                        -{formatPrice(cart.discount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Delivery fee
                    </span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {formatPrice(cart.shipping || 0)}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-3.5">
                    <div className="flex items-end justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Total
                      </span>
                      <span className="font-display text-2xl font-semibold text-brand-800 tabular-nums">
                        {formatPrice(cart.total || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Place Order Button - Mobile Optimized */}
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-3.5 md:py-4 text-white rounded-xl font-semibold bg-brand-700 hover:bg-brand-800 transition-colors flex items-center justify-center gap-2 text-[15px] md:text-base shadow-sm shadow-brand-900/10"
                >
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                  Place order for all stores
                </button>
                <p className="text-center text-[11px] text-gray-400 mt-3">
                  Payments are processed securely by Paystack
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Confirmation Modal -- shared with per-store checkout via the
          same OrderModal component below (storeGroup=null means "all
          stores"), instead of duplicating this whole form inline. */}
      {showOrderModal && (
        <OrderModal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          onConfirm={handleConfirmOrder}
          onResumeExistingOrder={(orderId) => router.push(orderHref(orderId))}
          customer={customer}
          storeGroup={null}
          storeCount={storeGroups.length}
          totalAmount={cart.total || 0}
          itemCount={getCartCount()}
          primaryColor={BRAND_PRIMARY}
          secondaryColor={BRAND_LIGHT}
          formatPrice={formatPrice}
        />
      )}

      {/* WhatsApp Auto-Redirect Modal */}
      {redirectingToWhatsApp && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: `${BRAND_PRIMARY}20` }}
            >
              <MessageCircle
                className="w-10 h-10"
                style={{ color: BRAND_PRIMARY }}
              />
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Order Placed Successfully! 🎉
            </h3>
            <p className="text-gray-600 mb-6">
              Redirecting you to WhatsApp to contact the store for faster order
              fulfillment...
            </p>

            <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
              <div
                className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{
                  borderColor: BRAND_PRIMARY,
                  borderTopColor: "transparent",
                }}
              ></div>
              <span>Opening WhatsApp...</span>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Contact Modal for Multiple Stores */}
      {showWhatsAppModal && (
        <WhatsAppContactModal
          isOpen={showWhatsAppModal}
          onClose={handleWhatsAppModalClose}
          order={{ stores: orderStores, orderNumber }}
          contactOnly
          willRedirectToPayment={Boolean(pendingPaymentOrderId)}
          formatPrice={formatPrice}
          openWhatsApp={openWhatsApp}
        />
      )}

      {/* Per-Store Checkout Modal - Replaced with OrderModal component */}
      {showStoreOrderModal && (
        <OrderModal
          isOpen={showStoreOrderModal}
          onClose={() => {
            setShowStoreOrderModal(false);
            setSelectedStoreGroup(null);
          }}
          onConfirm={handleStoreConfirmOrder}
          onResumeExistingOrder={(orderId) => router.push(orderHref(orderId))}
          customer={customer}
          storeGroup={selectedStoreGroup}
          totalAmount={selectedStoreGroup?.items.reduce(
            (sum, item) => sum + (item.subtotal || item.price * item.quantity),
            0
          )}
          itemCount={selectedStoreGroup?.items.reduce((sum, item) => sum + item.quantity, 0)}
          primaryColor={BRAND_PRIMARY}
          secondaryColor={BRAND_LIGHT}
          formatPrice={formatPrice}
        />
      )}
    </div>
  );
}
