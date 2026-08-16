"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
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
  Phone,
  Store,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import CustomDropdown from "@/components/ui/CustomDropdown";
import useStoreStore from "@/stores/storeStore";
import WhatsAppContactModal from "@/components/orders/WhatsAppContactModal";
import OrderModal from "@/components/cart/OrderModal";
import { usePaystackReady } from "@/hooks/usePaystackReady";

export default function StoreCartPage({ params }) {
  const router = useRouter();
  const store = router.state?.store;
  const resolvedParams = use(params);
  const { isAuthenticated, customer } = useAuth();
  const {
    cart,
    isLoading,
    removeFromCart,
    updateQuantity,
    getCartTotal,
    getCartCount,
    clearCart,
  } = useCart();

  // Get store from Zustand store
  const { currentStore, fetchStore } = useStoreStore();

  // Cart functionality state
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [shippingAddress, setShippingAddress] = useState({
    phone: "",
    street: "",
    city: "",
    state: "",
    landmark: "", // Optional landmark for easier delivery
  });
  const [isValidatingWhatsApp, setIsValidatingWhatsApp] = useState(false);
  const [whatsAppValidated, setWhatsAppValidated] = useState(false);

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

  // Tracks whether Paystack's inline.js has actually finished loading.
  // <Script strategy="afterInteractive"> below can still be mid-load the
  // moment a customer hits confirm -- without this, checkout would create
  // the order, clear the cart, and notify the vendor, then only discover
  // window.PaystackPop doesn't exist yet and silently never show a popup.
  const { markReady: markPaystackReady, waitForReady: waitForPaystackReady } = usePaystackReady();

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

  // Fetch store if not loaded
  useEffect(() => {
    if (
      resolvedParams.slug &&
      (!currentStore ||
        currentStore.website?.websitePath !== resolvedParams.slug)
    ) {
      fetchStore(resolvedParams.slug);
    }
  }, [resolvedParams.slug, currentStore, fetchStore]);

  // Nigerian states array
  const nigerianStates = [
    "Abia",
    "Adamawa",
    "Akwa Ibom",
    "Anambra",
    "Bauchi",
    "Bayelsa",
    "Benue",
    "Borno",
    "Cross River",
    "Delta",
    "Ebonyi",
    "Edo",
    "Ekiti",
    "Enugu",
    "FCT",
    "Gombe",
    "Imo",
    "Jigawa",
    "Kaduna",
    "Kano",
    "Katsina",
    "Kebbi",
    "Kogi",
    "Kwara",
    "Lagos",
    "Nasarawa",
    "Niger",
    "Ogun",
    "Ondo",
    "Osun",
    "Oyo",
    "Plateau",
    "Rivers",
    "Sokoto",
    "Taraba",
    "Yobe",
    "Zamfara",
  ];

  const stateOptions = nigerianStates.map((state) => ({
    value: state,
    label: state,
  }));

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/${resolvedParams.slug}`);
    }
  }, [isAuthenticated, isLoading, router, resolvedParams.slug]);

  // Store colors with fallbacks
  console.log("store; ", currentStore);
  const primaryColor = currentStore?.branding?.primaryColor || "#0D9488";
  const secondaryColor = currentStore?.branding?.secondaryColor || "#F3F4F6";
  const currency = currentStore?.settings?.currency || "NGN";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div
            className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-4 mb-4"
            style={{ borderTopColor: primaryColor }}
          ></div>
          <p className="text-gray-600">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (!cart || cart.items?.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
            <button
              onClick={() => router.push(`/${resolvedParams.slug}`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Continue Shopping</span>
            </button>
          </div>
        </div>

        {/* Empty Cart */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          <div className="text-center max-w-md mx-auto">
            <div className="text-8xl mb-6">🛒</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Your Cart is Empty
            </h2>
            <p className="text-gray-600 mb-8">
              Looks like you haven't added anything to your cart yet. Start
              shopping to fill it up!
            </p>
            <button
              onClick={() => router.push(`/${resolvedParams.slug}`)}
              className="inline-flex items-center gap-2 px-8 py-4 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingBag className="w-5 h-5" />
              Start Shopping
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

  // ...existing handlers...
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

  const handleShippingAddressChange = (e) => {
    const { name, value } = e.target;
    setShippingAddress((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "phone") {
      setWhatsAppValidated(false);
    }
  };

  const validateWhatsAppNumber = async () => {
    if (!shippingAddress.phone || shippingAddress.phone.trim() === "") {
      setOrderError("Please enter a phone number");
      return;
    }

    setIsValidatingWhatsApp(true);
    setOrderError(null);

    try {
      const formattedPhone = shippingAddress.phone.replace(/\s/g, "");
      const nigerianPhoneRegex = /^(\+234|0)[789]\d{9}$/;

      if (!nigerianPhoneRegex.test(formattedPhone)) {
        setOrderError(
          "Please enter a valid Nigerian phone number (e.g., 08012345678 or +2348012345678)"
        );
        setIsValidatingWhatsApp(false);
        return;
      }

      setWhatsAppValidated(true);
      setOrderError(null);
    } catch (error) {
      setOrderError("Failed to validate phone number");
    } finally {
      setIsValidatingWhatsApp(false);
    }
  };

  const handlePlaceOrder = () => {
    setShippingAddress({
      phone: customer?.phone || "",
      street: "",
      city: "",
      state: "",
      landmark: "",
    });
    setWhatsAppValidated(false);
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

  // Shared by both checkout flows below. Never trusts the popup's own
  // onSuccess callback as proof of payment -- that's just a UI event, so
  // it always follows up with a server-side /api/payments/verify call
  // (same idempotent core the webhook uses) before resolving success.
  const triggerPaystackPayment = (orderId) => {
    return new Promise((resolve) => {
      (async () => {
        try {
          setIsConfirmingPayment(true);
          const initRes = await fetch("/api/payments/initiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ orderId }),
          });
          const initData = await initRes.json();

          if (!initRes.ok || !initData.success) {
            setOrderError(initData.message || "Could not start payment");
            setIsConfirmingPayment(false);
            resolve({ success: false });
            return;
          }

          if (typeof window === "undefined" || !window.PaystackPop) {
            setOrderError("Payment isn't ready yet -- please try again in a moment");
            setIsConfirmingPayment(false);
            resolve({ success: false });
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
                  setOrderError(verifyData.message || "Payment could not be confirmed");
                }
                resolve({ success: Boolean(verifyData.success) });
              } catch (error) {
                console.error("Error verifying payment:", error);
                setOrderError("Payment could not be confirmed. Please contact support.");
                resolve({ success: false });
              } finally {
                setIsConfirmingPayment(false);
              }
            },
            onCancel: () => {
              setIsConfirmingPayment(false);
              resolve({ success: false, cancelled: true });
            },
          });
        } catch (error) {
          console.error("Error starting payment:", error);
          setOrderError("Could not start payment. Please try again.");
          setIsConfirmingPayment(false);
          resolve({ success: false });
        }
      })();
    });
  };

  const handleConfirmOrder = async () => {
    // Validate all required fields
    if (
      !shippingAddress.phone ||
      !shippingAddress.street ||
      !shippingAddress.city ||
      !shippingAddress.state
    ) {
      setOrderError(
        "Please provide complete delivery address (phone, street address, city, and state)"
      );
      return;
    }

    if (!whatsAppValidated) {
      setOrderError("Please validate your WhatsApp number first");
      return;
    }

    setIsPlacingOrder(true);
    setOrderError(null);

    // Wait for Paystack's script before creating the order at all -- every
    // checkout here is sent as paymentMethod: "paystack", so if the popup
    // won't be able to open, better to find out now than after the order
    // is created, the cart is cleared, and the vendor already notified.
    const paystackOk = await waitForPaystackReady();
    if (!paystackOk) {
      setOrderError(
        "Payment isn't ready yet -- please check your connection and try again in a moment"
      );
      setIsPlacingOrder(false);
      return;
    }

    try {
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cartId: cart._id,
          shippingAddress: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: shippingAddress.phone,
            street: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.state,
            country: "Nigeria",
            landmark: shippingAddress.landmark || "", // Optional landmark
          },
          customerNotes: "",
          paymentMethod: "paystack",
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await clearCart();
        setShowOrderModal(false);

        if (data.paymentSplitError) {
          setOrderError(data.paymentSplitError);
        }

        // Real Paystack payment for whichever vendors in this cart have a
        // subaccount configured -- if none do (or paymentMethod wasn't
        // paystack at all), paymentRequired is false and this is a no-op.
        // A cancelled or failed payment stops here rather than falling
        // through to the WhatsApp-contact step below: the order and its
        // reservation still exist either way, so the customer can retry
        // paying from the order page rather than this juggling both a
        // half-completed payment and a WhatsApp handoff in one flow.
        if (data.paymentRequired) {
          const paymentResult = await triggerPaystackPayment(data.order.id);
          if (!paymentResult.success) {
            return;
          }
        }

        const contactOnlyStores = data.contactOnlyStores || [];
        if (contactOnlyStores.length > 0) {
          // Vendors with no Paystack subaccount yet -- same WhatsApp-contact
          // fallback as before, just scoped to only these stores instead
          // of the whole cart.
          setOrderNumber(data.order.orderNumber);
          setOrderStores(contactOnlyStores);
          setShowWhatsAppModal(true);
        } else {
          router.push(`/${resolvedParams.slug}/orders/${data.order.id}`);
        }
      } else {
        setOrderError(data.message || "Failed to place order");
      }
    } catch (error) {
      console.error("Error placing order:", error);
      setOrderError(
        "An error occurred while placing your order. Please try again."
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleWhatsAppModalClose = () => {
    setShowWhatsAppModal(false);

    // Navigate to order details after closing modal
    if (orderNumber) {
      // Find the order ID from the stores data or use orderNumber to navigate
      router.push(`/${resolvedParams.slug}/orders`);
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
      // Same readiness gate as handleConfirmOrder -- this path also always
      // sends paymentMethod: "paystack".
      const paystackOk = await waitForPaystackReady();
      if (!paystackOk) {
        throw new Error(
          "Payment isn't ready yet -- please check your connection and try again in a moment"
        );
      }

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
        await clearCart();
        setShowStoreOrderModal(false);
        setSelectedStoreGroup(null);

        // A cancelled/failed payment leaves the order exactly as created
        // (unpaid, reservation intact) -- close this modal and stop here
        // rather than throw, since OrderModal's error UI is meant for
        // checkout-creation failures, not a user backing out of paying.
        if (data.paymentRequired) {
          const paymentResult = await triggerPaystackPayment(data.order.id);
          if (!paymentResult.success) {
            return;
          }
        }

        const contactOnlyStores = data.contactOnlyStores || [];
        if (contactOnlyStores.length > 0) {
          setOrderNumber(data.order.orderNumber);
          setOrderStores(contactOnlyStores);
          setShowWhatsAppModal(true);
        } else {
          router.push(`/${resolvedParams.slug}/orders/${data.order.id}`);
        }
      } else {
        throw new Error(data.message || "Failed to place order");
      }
    } catch (error) {
      console.error("Error placing order:", error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 text-sm">{orderError}</p>
          </div>
        </div>
      )}

      {/* Header - Mobile Optimized */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/${resolvedParams.slug}`)}
                className="flex items-center gap-1 md:gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium text-sm md:text-base truncate max-w-[120px] md:max-w-none">
                  {currentStore?.storeName || "Store"}
                </span>
              </button>
              {!isMobile && (
                <>
                  <span className="text-gray-300">›</span>
                  <span className="font-medium text-gray-900">Cart</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
              <span className="font-semibold text-gray-900 text-sm md:text-base">
                {getCartCount()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile Optimized */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-8">
          YOUR CART
        </h1>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
          {/* Cart Items - Enhanced with Expandable Details */}
          <div className="lg:col-span-2 space-y-3 md:space-y-6">
            {storeGroups.map((storeGroup, idx) => (
              <div
                key={idx}
                className="relative bg-white rounded-xl md:rounded-2xl border border-gray-100 overflow-hidden flex flex-col"
              >
                {/* Store Header */}
                {storeGroup.storeSnapshot && (
                  <div
                    className="px-3 md:px-6 py-2 md:py-3 border-b border-gray-100"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <p className="font-semibold text-gray-900 text-sm md:text-base truncate">
                      From: {storeGroup.storeSnapshot.store_name || storeGroup.storeSnapshot.storeName}
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
                        <div className="flex gap-2 md:gap-4">
                          {/* Product Image - Now uses variant image if available */}
                          <div className="flex-shrink-0">
                            <div
                              className={`${
                                isMobile ? "w-20 h-20" : "w-32 h-32"
                              } rounded-lg md:rounded-xl overflow-hidden relative`}
                              style={{ backgroundColor: secondaryColor }}
                            >
                              {itemImage ? (
                                <img
                                  src={itemImage}
                                  alt={item.product_snapshot?.product_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div
                                  className={`w-full h-full flex items-center justify-center ${
                                    isMobile ? "text-2xl" : "text-4xl"
                                  }`}
                                >
                                  📦
                                </div>
                              )}
                              {/* Variant Badge */}
                              {item.variant && (
                                <div className="absolute bottom-1 left-1 right-1 bg-black/70 backdrop-blur-sm text-white text-[10px] text-center py-0.5 px-1 rounded">
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
                                className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                              </button>
                            </div>

                            <p
                              className="text-lg md:text-2xl font-bold mb-2 md:mb-4"
                              style={{ color: primaryColor }}
                            >
                              {formatPrice(item.price)}
                            </p>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2 md:gap-4">
                              <div className="flex items-center border border-gray-300 rounded-lg md:rounded-xl overflow-hidden">
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
                                  className="px-2 md:px-4 py-1.5 md:py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Minus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
                                </button>
                                <span className="px-3 md:px-6 py-1.5 md:py-2 font-semibold text-gray-900 min-w-[40px] md:min-w-[60px] text-center text-sm md:text-base">
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
                                  className="px-2 md:px-4 py-1.5 md:py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Plus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
                                </button>
                              </div>

                              {updatingItemId === item.product_id && (
                                <span className="text-xs md:text-sm text-gray-500">
                                  Updating...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expand/Collapse Button - Positioned at bottom-right */}
                        {showExpandButton && (
                          <button
                            onClick={() => toggleItemExpansion(itemId)}
                            className="absolute bottom-3 right-3 md:bottom-6 md:right-6 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors bg-white px-3 py-1.5 rounded-lg "
                          >
                            <span className="font-medium">
                              {isExpanded ? "Hide Details" : "Show Details"}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Expanded Details Section */}
                        {isExpanded && showExpandButton && (
                          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                            {/* Variant Details */}
                            {item.variant && (
                              <div
                                className="rounded-lg p-3"
                                style={{ backgroundColor: `${primaryColor}05` }}
                              >
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                  Variant Details
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
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <h4 className="text-sm font-semibold text-amber-900 mb-1 flex items-center gap-2">
                                  <Tag className="w-4 h-4" />
                                  Notes
                                </h4>
                                <p className="text-sm text-amber-800">
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

                {/* Store Footer Panel with Place Order Button */}
                <div
                  className="px-3 md:px-6 py-3 md:py-4 border-t border-gray-100 bg-white flex items-center justify-between"
                  style={{
                    backgroundColor: `${primaryColor}05`,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 font-medium mb-0.5">
                      Store Subtotal
                    </span>
                    <span
                      className="text-base md:text-lg font-bold"
                      style={{ color: primaryColor }}
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
                    className="px-4 py-2 md:px-6 md:py-3 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-white text-sm md:text-base"
                    style={{
                      background: `linear-gradient(90deg, ${primaryColor} 60%, ${primaryColor} 100%)`,
                      boxShadow: "0 2px 8px 0 rgba(16, 185, 129, 0.08)",
                    }}
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Place Order</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary - Mobile Optimized */}
          <div className="lg:col-span-1">
            <div
              className={`bg-white rounded-xl md:rounded-2xl border border-gray-100 overflow-hidden ${
                !isMobile && "sticky top-24"
              }`}
            >
              <div className="p-4 md:p-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">
                  Order Summary
                </h2>

                <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm md:text-base text-gray-600">
                      Subtotal
                    </span>
                    <span className="text-base md:text-lg font-semibold text-gray-900">
                      {formatPrice(cart.subtotal || 0)}
                    </span>
                  </div>

                  {cart.discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm md:text-base text-gray-600">
                        Discount
                      </span>
                      <span className="text-base md:text-lg font-semibold text-red-600">
                        -{formatPrice(cart.discount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm md:text-base text-gray-600">
                      Delivery Fee
                    </span>
                    <span className="text-base md:text-lg font-semibold text-gray-900">
                      {formatPrice(cart.shipping || 0)}
                    </span>
                  </div>

                  <div className="border-t border-gray-200 pt-3 md:pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-base md:text-lg font-semibold text-gray-900">
                        Total
                      </span>
                      <span
                        className="text-xl md:text-2xl font-bold"
                        style={{ color: primaryColor }}
                      >
                        {formatPrice(cart.total || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Place Order Button - Mobile Optimized */}
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-3 md:py-4 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-base md:text-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                  Place Order for All Stores
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Confirmation Modal with Store Colors */}
      {showOrderModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="bg-white rounded-2xl max-w-md max-h-[90dvh] w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div
              className="text-center p-6 flex-shrink-0"
              style={{ backgroundColor: `${primaryColor}10` }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <ShoppingBag
                  className="w-8 h-8"
                  style={{ color: primaryColor }}
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Complete Your Order
              </h3>
              <p className="text-gray-600">
                Provide delivery details to proceed
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Customer Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={`${customer?.firstName} ${customer?.lastName}`}
                    disabled
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900"
                    style={{ backgroundColor: secondaryColor }}
                  />
                </div>

                {/* WhatsApp Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    WhatsApp Phone Number *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      name="phone"
                      value={shippingAddress.phone}
                      onChange={handleShippingAddressChange}
                      placeholder="08012345678"
                      disabled={whatsAppValidated}
                      className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 text-gray-900 ${
                        whatsAppValidated
                          ? "bg-green-50 border-green-300"
                          : "border-gray-300 bg-white"
                      }`}
                      style={{ "--tw-ring-color": primaryColor }}
                    />
                    {!whatsAppValidated ? (
                      <button
                        onClick={validateWhatsAppNumber}
                        disabled={isValidatingWhatsApp}
                        className="px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {isValidatingWhatsApp ? "Validating..." : "Validate"}
                      </button>
                    ) : (
                      <div className="flex items-center px-4 bg-green-50 border border-green-300 rounded-xl flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Ensure this is your WhatsApp number for order updates
                  </p>
                </div>

                {/* Delivery Address Section */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Delivery Address
                  </h4>

                  {/* Street Address */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address *
                    </label>
                    <textarea
                      name="street"
                      value={shippingAddress.street}
                      onChange={handleShippingAddressChange}
                      placeholder="e.g., No. 15, Allen Avenue, Ikeja"
                      rows="2"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 bg-white text-gray-900 resize-none"
                      style={{ "--tw-ring-color": primaryColor }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Include house number and street name
                    </p>
                  </div>

                  {/* City */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City/Town *
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={shippingAddress.city}
                      onChange={handleShippingAddressChange}
                      placeholder="e.g., Ikeja, Lekki, Surulere"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 bg-white text-gray-900"
                      style={{ "--tw-ring-color": primaryColor }}
                    />
                  </div>

                  {/* State */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State *
                    </label>
                    <CustomDropdown
                      options={stateOptions}
                      value={shippingAddress.state}
                      onChange={(value) =>
                        handleShippingAddressChange({
                          target: { name: "state", value },
                        })
                      }
                      placeholder="Select your state"
                      backgroundColor="#FFFFFF"
                      error={false}
                    />
                  </div>

                  {/* Landmark (Optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      name="landmark"
                      value={shippingAddress.landmark}
                      onChange={handleShippingAddressChange}
                      placeholder="e.g., Near GTBank, Opposite Shoprite"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 bg-white text-gray-900"
                      style={{ "--tw-ring-color": primaryColor }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This helps the delivery person find you easily
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-4 my-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Items:</span>
                    <span className="font-semibold text-gray-900">
                      {getCartCount()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Stores:</span>
                    <span className="font-semibold text-gray-900">
                      {storeGroups.length}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 my-2"></div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">
                      Total Amount:
                    </span>
                    <span
                      className="text-xl font-bold"
                      style={{ color: primaryColor }}
                    >
                      {formatPrice(cart.total || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {orderError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-sm">{orderError}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOrderModal(false)}
                  disabled={isPlacingOrder}
                  className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmOrder}
                  disabled={
                    isPlacingOrder ||
                    !whatsAppValidated ||
                    !shippingAddress.street ||
                    !shippingAddress.city ||
                    !shippingAddress.state
                  }
                  className="flex-1 py-3 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isPlacingOrder ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Placing Order...
                    </>
                  ) : (
                    "Confirm Order"
                  )}
                </button>
              </div>

              {/* Additional Info */}
              <p className="text-xs text-gray-500 text-center mt-4">
                You will receive order confirmations on WhatsApp from each store
              </p>
            </div>
          </div>
        </div>
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
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <MessageCircle
                className="w-10 h-10"
                style={{ color: primaryColor }}
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
                  borderColor: primaryColor,
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
          primaryColor={primaryColor}
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
          customer={customer}
          storeGroup={selectedStoreGroup}
          totalAmount={selectedStoreGroup?.items.reduce(
            (sum, item) => sum + (item.subtotal || item.price * item.quantity),
            0
          )}
          itemCount={selectedStoreGroup?.items.reduce((sum, item) => sum + item.quantity, 0)}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          formatPrice={formatPrice}
        />
      )}

      {/* ...existing other modals... */}
    </div>
  );
}
