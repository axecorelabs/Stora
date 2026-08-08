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
  Phone,
  Store,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import CustomDropdown from "@/components/ui/CustomDropdown";
import WhatsAppContactModal from "@/components/orders/WhatsAppContactModal";

export default function CartPage() {
  const router = useRouter();
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
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [shippingAddress, setShippingAddress] = useState({
    phone: "",
    city: "",
    state: "",
    email: "",
    street: "",
  });
  const [isValidatingWhatsApp, setIsValidatingWhatsApp] = useState(false);
  const [whatsAppValidated, setWhatsAppValidated] = useState(false);
  const [orderNumber, setOrderNumber] = useState(null);
  const [orderStores, setOrderStores] = useState([]);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [redirectingToWhatsApp, setRedirectingToWhatsApp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());

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

  // Convert states to dropdown options
  const stateOptions = nigerianStates.map((state) => ({
    value: state,
    label: state,
  }));

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-emerald-600 mb-4"></div>
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
              onClick={() => router.back()}
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
              Looks like you haven't added anything to your cart yet. Start shopping
              to fill it up!
            </p>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
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
    return `₦${price?.toLocaleString()}`;
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
    // TODO: Implement coupon application API
    setTimeout(() => {
      setIsApplyingCoupon(false);
      alert("Coupon functionality coming soon!");
    }, 1000);
  };

  const handleCheckout = () => {
    router.push("/checkout");
  };

  const handleShippingAddressChange = (e) => {
    const { name, value } = e.target;
    setShippingAddress((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Reset WhatsApp validation if phone changes
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
      // Format phone number for validation
      const formattedPhone = shippingAddress.phone.replace(/\s/g, "");

      // Basic validation for Nigerian numbers
      const nigerianPhoneRegex = /^(\+234|0)[789]\d{9}$/;
      if (!nigerianPhoneRegex.test(formattedPhone)) {
        setOrderError(
          "Please enter a valid Nigerian phone number (e.g., 08012345678 or +2348012345678)"
        );
        setIsValidatingWhatsApp(false);
        return;
      }

      // TODO: Implement actual WhatsApp validation API
      // For now, we'll just validate the format
      setWhatsAppValidated(true);
      setOrderError(null);
    } catch (error) {
      setOrderError("Failed to validate phone number");
    } finally {
      setIsValidatingWhatsApp(false);
    }
  };

  const handlePlaceOrder = () => {
    // Reset form
    setShippingAddress({
      phone: customer?.phone || "",
      city: "",
      state: "",
      email: customer?.email || "",
      street: "",
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
        `I just placed an order through your IVMA store:\n` +
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

    const cleanPhone = storePhone.replace(/\s/g, "").replace(/^0/, "234");
    const formattedPhone = cleanPhone.startsWith("+")
      ? cleanPhone.substring(1)
      : cleanPhone;

    const customerName = `${customer?.firstName || ""} ${
      customer?.lastName || ""
    }`.trim();
    const message = formatWhatsAppMessage(storeName, orderNumber, customerName, itemCount);

    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleConfirmOrder = async () => {
    // Validate all required fields
    if (
      !shippingAddress.phone ||
      !shippingAddress.email ||
      !shippingAddress.street ||
      !shippingAddress.city ||
      !shippingAddress.state
    ) {
      setOrderError(
        "Please provide complete delivery information (email, phone, street address, city, and state)"
      );
      return;
    }

    if (!whatsAppValidated) {
      setOrderError("Please validate your WhatsApp number first");
      return;
    }

    setIsPlacingOrder(true);
    setOrderError(null);

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
            email: customer.email, // Use customer email
            phone: shippingAddress.phone,
            street: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.state,
            country: "Nigeria",
            landmark: shippingAddress.landmark || "",
          },
          customerNotes: "",
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await clearCart();
        setShowOrderModal(false);

        // Set order data for WhatsApp contact
        setOrderNumber(data.order.orderNumber);
        setOrderStores(data.order.stores || []);

        // Check if single store or multiple stores
        const stores = data.order.stores || [];

        if (stores.length === 1) {
          // Single store - auto-redirect to WhatsApp
          const store = stores[0];
          if (store.storeSnapshot?.storePhone) {
            setRedirectingToWhatsApp(true);

            setTimeout(() => {
              openWhatsApp(
                store.storeSnapshot.storePhone,
                store.storeSnapshot.storeName || store.storeName,
                store.itemCount
              );
              setRedirectingToWhatsApp(false);

              setTimeout(() => {
                router.push(`/orders/${data.order._id}`);
              }, 2000);
            }, 1500);
          } else {
            router.push(`/orders/${data.order._id}`);
          }
        } else if (stores.length > 1) {
          // Multiple stores - show WhatsApp contact modal
          setShowWhatsAppModal(true);
        } else {
          router.push(`/orders/${data.order._id}`);
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
    router.push("/orders");
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
    // If item has variant with image, use variant image
    if (item.variant?.image) {
      return item.variant.image;
    }
    // Otherwise use product snapshot image
    return item.productSnapshot?.image;
  };

  const hasExtraDetails = (item) => {
    return item.variant || item.notes;
  };

  // Group items by store
  const itemsByStore =
    cart.items?.reduce((acc, item) => {
      const storeId = item.store?._id || item.store;
      if (!acc[storeId]) {
        acc[storeId] = {
          store: item.store,
          storeSnapshot: item.storeSnapshot,
          items: [],
        };
      }
      acc[storeId].items.push(item);
      return acc;
    }, {}) || {};

  const storeGroups = Object.values(itemsByStore);

  // New state for per-store checkout
  const [storeCheckoutModal, setStoreCheckoutModal] = useState(null); // storeGroup or null
  const [isPlacingStoreOrder, setIsPlacingStoreOrder] = useState(false);
  const [storeOrderError, setStoreOrderError] = useState(null);

  // Per-store order handlers
  const handleStorePlaceOrder = (storeGroup) => {
    setStoreCheckoutModal({
      storeGroup,
      shippingAddress: {
        phone: customer?.phone || "",
        city: "",
        state: "",
        email: customer?.email || "",
        street: "",
      },
      whatsAppValidated: false,
      isValidatingWhatsApp: false,
      orderError: null,
    });
  };

  const handleStoreShippingAddressChange = (e) => {
    const { name, value } = e.target;
    setStoreCheckoutModal((prev) => ({
      ...prev,
      shippingAddress: {
        ...prev.shippingAddress,
        [name]: value,
      },
      whatsAppValidated: name === "phone" ? false : prev.whatsAppValidated,
    }));
  };

  const handleStoreValidateWhatsApp = async () => {
    const phone = storeCheckoutModal.shippingAddress.phone;
    if (!phone || phone.trim() === "") {
      setStoreCheckoutModal((prev) => ({ ...prev, orderError: "Please enter a phone number" }));
      return;
    }
    setStoreCheckoutModal((prev) => ({ ...prev, isValidatingWhatsApp: true, orderError: null }));
    try {
      const formattedPhone = phone.replace(/\s/g, "");
      const nigerianPhoneRegex = /^(\+234|0)[789]\d{9}$/;
      if (!nigerianPhoneRegex.test(formattedPhone)) {
        setStoreCheckoutModal((prev) => ({
          ...prev,
          orderError: "Please enter a valid Nigerian phone number (e.g., 08012345678 or +2348012345678)",
          isValidatingWhatsApp: false,
        }));
        return;
      }
      setStoreCheckoutModal((prev) => ({
        ...prev,
        whatsAppValidated: true,
        isValidatingWhatsApp: false,
        orderError: null,
      }));
    } catch {
      setStoreCheckoutModal((prev) => ({
        ...prev,
        orderError: "Failed to validate phone number",
        isValidatingWhatsApp: false,
      }));
    }
  };

  const handleStoreConfirmOrder = async () => {
    const { shippingAddress, storeGroup, whatsAppValidated } = storeCheckoutModal;
    if (!shippingAddress.phone || !shippingAddress.city || !shippingAddress.state) {
      setStoreCheckoutModal((prev) => ({ ...prev, orderError: "Please provide your phone number, city, and state" }));
      return;
    }
    if (!whatsAppValidated) {
      setStoreCheckoutModal((prev) => ({ ...prev, orderError: "Please validate your WhatsApp number first" }));
      return;
    }
    setIsPlacingStoreOrder(true);
    setStoreOrderError(null);
    try {
      // Prepare item IDs for this store
      const itemIds = storeGroup.items.map((item) => item._id);
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cartId: cart._id,
          itemIds, // Only items for this store
          shippingAddress: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: shippingAddress.phone,
            city: shippingAddress.city,
            state: shippingAddress.state,
            country: "Nigeria",
          },
          customerNotes: "",
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        await clearCart(); // Optionally, remove only these items from cart instead
        setStoreCheckoutModal(null);
        router.push(`/orders/${data.order._id}`);
      } else {
        setStoreOrderError(data.message || "Failed to place order");
      }
    } catch (error) {
      setStoreOrderError("An error occurred while placing your order. Please try again.");
    } finally {
      setIsPlacingStoreOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Optimized */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1 md:gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium text-sm md:text-base">Home</span>
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-8">
          YOUR CART
        </h1>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
          {/* Cart Items - Mobile Optimized with Expandable Details */}
          <div className="lg:col-span-2 space-y-3 md:space-y-6">
            {storeGroups.map((storeGroup, idx) => (
              <div
                key={idx}
                className="relative bg-white rounded-xl md:rounded-2xl border border-gray-100 overflow-hidden"
              >
                {/* Store Header */}
                {storeGroup.storeSnapshot && (
                  <div className="bg-gray-50 px-3 md:px-6 py-2 md:py-3 border-b border-gray-100">
                    <p className="font-semibold text-gray-900 text-sm md:text-base">
                      From: {storeGroup.storeSnapshot.storeName}
                    </p>
                  </div>
                )}

                {/* Items - Enhanced with Expandable Details */}
                <div className="divide-y divide-gray-100">
                  {storeGroup.items.map((item) => {
                    const itemId = item._id;
                    const isExpanded = expandedItems.has(itemId);
                    const showExpandButton = hasExtraDetails(item);
                    const itemImage = getItemImage(item);

                    return (
                      <div key={itemId} className="p-3 md:p-6">
                        <div className="flex gap-2 md:gap-4">
                          {/* Product Image - Now uses variant image if available */}
                          <div className="flex-shrink-0">
                            <div
                              className={`${
                                isMobile ? "w-20 h-20" : "w-32 h-32"
                              } bg-gray-100 rounded-lg md:rounded-xl overflow-hidden relative`}
                            >
                              {itemImage ? (
                                <img
                                  src={itemImage}
                                  alt={item.productSnapshot?.productName}
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
                                  Variant
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1 md:mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-0.5 md:mb-1 line-clamp-2">
                                  {item.productSnapshot?.productName}
                                </h3>
                                {item.productSnapshot?.category && (
                                  <p className="text-xs md:text-sm text-gray-500">
                                    {item.productSnapshot.category}
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
                                {!isMobile && item.productSnapshot?.sku && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    SKU: {item.productSnapshot.sku}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  handleRemoveItem(item.product._id || item.product)
                                }
                                className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                              </button>
                            </div>

                            <p className="text-lg md:text-2xl font-bold text-gray-900 mb-2 md:mb-4">
                              {formatPrice(item.price)}
                            </p>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2 md:gap-4">
                              <div className="flex items-center border border-gray-300 rounded-lg md:rounded-xl overflow-hidden">
                                <button
                                  onClick={() =>
                                    handleQuantityChange(
                                      item.product._id || item.product,
                                      item.quantity - 1
                                    )
                                  }
                                  disabled={
                                    item.quantity <= 1 ||
                                    updatingItemId === (item.product._id || item.product)
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
                                      item.product._id || item.product,
                                      item.quantity + 1
                                    )
                                  }
                                  disabled={updatingItemId === (item.product._id || item.product)}
                                  className="px-2 md:px-4 py-1.5 md:py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Plus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
                                </button>
                              </div>

                              {updatingItemId === (item.product._id || item.product) && (
                                <span className="text-xs md:text-sm text-gray-500">
                                  Updating...
                                </span>
                              )}
                            </div>

                            {/* Expand/Collapse Button */}
                            {showExpandButton && (
                              <button
                                onClick={() => toggleItemExpansion(itemId)}
                                className="mt-3 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
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
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                      Variant Details
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      {item.variant.color && (
                                        <div>
                                          <span className="text-gray-500">Color:</span>
                                          <span className="ml-2 font-medium text-gray-900">
                                            {item.variant.color}
                                          </span>
                                        </div>
                                      )}
                                      {item.variant.size && (
                                        <div>
                                          <span className="text-gray-500">Size:</span>
                                          <span className="ml-2 font-medium text-gray-900">
                                            {item.variant.size}
                                          </span>
                                        </div>
                                      )}
                                      {item.variant.sku && (
                                        <div className="col-span-2">
                                          <span className="text-gray-500">Variant SKU:</span>
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
                                      {item.productSnapshot.brand && (
                                        <div>
                                          <span className="text-gray-500">Brand:</span>
                                          <span className="ml-2 font-medium text-gray-900">
                                            {item.productSnapshot.brand}
                                          </span>
                                        </div>
                                      )}
                                      {item.productSnapshot.unitOfMeasure && (
                                        <div>
                                          <span className="text-gray-500">Unit:</span>
                                          <span className="ml-2 font-medium text-gray-900">
                                            {item.productSnapshot.unitOfMeasure}
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
                                    <p className="text-sm text-amber-800">{item.notes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Place Order Button for this store */}
                <div className="absolute bottom-4 right-4 z-10">
                  <button
                    onClick={() => handleStorePlaceOrder(storeGroup)}
                    className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Place Order for{" "}
                    {storeGroup.storeSnapshot?.storeName || "Store"}
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
                      <span className="text-xl md:text-2xl font-bold text-gray-900">
                        {formatPrice(cart.total || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Place Order Button - Mobile Optimized */}
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-3 md:py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 text-base md:text-lg"
                >
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                  Place Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Confirmation Modal */}
      {showOrderModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div
            className="bg-white rounded-2xl max-w-md max-h-[90dvh] w-full p-6"
            style={{ maxHeight: "95vh", overflowY: "auto" }}
          >
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Complete Your Order
              </h3>
              <p className="text-gray-600">Provide delivery details to proceed</p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6">
              {/* Shipping Address Form */}
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={`${customer?.firstName} ${customer?.lastName}`}
                    disabled
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900"
                  />
                </div>

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
                      placeholder="08012345678 or +2348012345678"
                      disabled={whatsAppValidated}
                      className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 ${
                        whatsAppValidated
                          ? "bg-green-50 border-green-300"
                          : "border-gray-300 bg-white"
                      }`}
                    />
                    {!whatsAppValidated ? (
                      <button
                        onClick={validateWhatsAppNumber}
                        disabled={isValidatingWhatsApp}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex-shrink-0"
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
                    Ensure the number above is your whatsapp number
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={shippingAddress.email}
                    onChange={handleShippingAddressChange}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  />
                </div>

                <div>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={shippingAddress.city}
                    onChange={handleShippingAddressChange}
                    placeholder="Enter your city"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    name="street"
                    value={shippingAddress.street}
                    onChange={handleShippingAddressChange}
                    placeholder="Enter your street address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
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
                    <span className="text-xl font-bold text-emerald-600">
                      {formatPrice(cart.total || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Store List */}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Orders will be sent to:
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {storeGroups.map((group, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="truncate">
                        {group.storeSnapshot?.storeName || "Store"}
                      </span>
                      <span className="text-gray-400">
                        ({group.items.length}{" "}
                        {group.items.length === 1 ? "item" : "items"})
                      </span>
                    </div>
                  ))}
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

            {/* Action Buttons - Fixed at bottom */}
            <div className="px-6 pb-6 pt-4 flex-shrink-0 border-t border-gray-100">
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
                    !shippingAddress.city ||
                    !shippingAddress.state
                  }
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
                    <>Confirm Order</>
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
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-emerald-600" />
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Order Placed Successfully! 🎉
            </h3>
            <p className="text-gray-600 mb-6">
              Redirecting you to WhatsApp to contact the store for faster order
              fulfillment...
            </p>

            <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
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
          primaryColor="#0D9488"
          formatPrice={formatPrice}
          openWhatsApp={openWhatsApp}
        />
      )}

      {/* Per-Store Checkout Modal */}
      {storeCheckoutModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Complete Order for{" "}
                {storeCheckoutModal.storeGroup.storeSnapshot?.storeName || "Store"}
              </h3>
              <p className="text-gray-600">Provide delivery details to proceed</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WhatsApp Phone Number *
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  name="phone"
                  value={storeCheckoutModal.shippingAddress.phone}
                  onChange={handleStoreShippingAddressChange}
                  placeholder="08012345678 or +2348012345678"
                  disabled={storeCheckoutModal.whatsAppValidated}
                  className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 ${
                    storeCheckoutModal.whatsAppValidated
                      ? "bg-green-50 border-green-300"
                      : "border-gray-300 bg-white"
                  }`}
                />
                {!storeCheckoutModal.whatsAppValidated ? (
                  <button
                    onClick={handleStoreValidateWhatsApp}
                    disabled={storeCheckoutModal.isValidatingWhatsApp}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {storeCheckoutModal.isValidatingWhatsApp
                      ? "Validating..."
                      : "Validate"}
                  </button>
                ) : (
                  <div className="flex items-center px-4 bg-green-50 border border-green-300 rounded-xl flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ensure the number above is your whatsapp number
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={storeCheckoutModal.shippingAddress.email}
                onChange={handleStoreShippingAddressChange}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State *
              </label>
              <CustomDropdown
                options={stateOptions}
                value={storeCheckoutModal.shippingAddress.state}
                onChange={(value) =>
                  handleStoreShippingAddressChange({
                    target: { name: "state", value },
                  })
                }
                placeholder="Select your state"
                backgroundColor="#FFFFFF"
                error={false}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <input
                type="text"
                name="city"
                value={storeCheckoutModal.shippingAddress.city}
                onChange={handleStoreShippingAddressChange}
                placeholder="Enter your city"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Street Address *
              </label>
              <input
                type="text"
                name="street"
                value={storeCheckoutModal.shippingAddress.street}
                onChange={handleStoreShippingAddressChange}
                placeholder="Enter your street address"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
              />
            </div>
            {storeCheckoutModal.orderError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-600 text-sm">
                  {storeCheckoutModal.orderError}
                </p>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStoreCheckoutModal(null)}
                disabled={isPlacingStoreOrder}
                className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStoreConfirmOrder}
                disabled={
                  isPlacingStoreOrder ||
                  !storeCheckoutModal.whatsAppValidated ||
                  !storeCheckoutModal.shippingAddress.city ||
                  !storeCheckoutModal.shippingAddress.state
                }
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPlacingStoreOrder ? (
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
                  <>Confirm Order</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
