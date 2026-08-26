"use client";
import { useState, useEffect, useMemo } from "react";
import { X, MapPin, Package, AlertCircle, CheckCircle, Truck, ChevronDown, ChevronUp } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { NIGERIAN_STATES } from "@stora/shared-constants";

export default function OrderModal({
  isOpen,
  onClose,
  onConfirm,
  onResumeExistingOrder, // (orderId) => void -- navigates to an order the
  // duplicate-checkout guard is blocking on; optional so callers that don't
  // wire it up just fall back to plain error text.
  customer,
  storeGroup = null, // If provided, this is a per-store checkout
  storeCount, // Only meaningful (and only shown) for whole-cart checkout
  deliverableStates, // null = nationwide/no restriction, [] = the stores
  // in this checkout share no common deliverable state (only possible on
  // a whole-cart, multi-vendor checkout), array = restricted to just these
  deliveryState, // The buyer's browse-time "this is where I am" (DeliveryStateContext)
  // -- used only to pre-fill the state field below, never trusted as the
  // real shipping address itself.
  totalAmount,
  commissionPassThrough = 0, // Platform commission passed to the customer
  // (commission_bearer: 'customer'), already excluded from totalAmount --
  // shown as its own line, then folded into the final total below.
  estimatedPaystackFee = 0, // Paystack's own processing fee, passed to the
  // customer -- see packages/shared-constants/checkoutFees.js. Same
  // treatment: shown separately, then included in the final total.
  storeDeliveryInfo = [], // [{storeId, storeName, deliveryFees, fulfillmentMethod,
  // paystackReady}] -- one entry per store in this checkout. Only this
  // component knows the destination state (formData.state below), so the
  // fee lookup happens here, live, as the customer picks/changes it.
  itemCount,
  primaryColor,
  secondaryColor,
  formatPrice
}) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    landmark: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingWhatsApp, setIsValidatingWhatsApp] = useState(false);
  const [whatsAppValidated, setWhatsAppValidated] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitErrorOrderId, setSubmitErrorOrderId] = useState(null);

  const noCommonDeliveryState = Array.isArray(deliverableStates) && deliverableStates.length === 0;
  const stateOptions = Array.isArray(deliverableStates) && deliverableStates.length > 0
    ? NIGERIAN_STATES.filter((s) => deliverableStates.includes(s.value))
    : NIGERIAN_STATES;

  // A store can only ever be charged as platform_collected if it's actually
  // paystack_ready -- mirrors the same fallback orders/create/route.js
  // applies server-side, so this preview never promises a "paid now" fee
  // the real checkout wouldn't honor.
  const [showDeliveryDetails, setShowDeliveryDetails] = useState(false);
  const deliveryBreakdown = useMemo(() => {
    const destinationState = formData.state;
    const perStore = (storeDeliveryInfo || []).map((info) => {
      const fee = destinationState ? (Number(info.deliveryFees?.[destinationState]) || 0) : 0;
      const method = (info.paystackReady && info.fulfillmentMethod !== 'pay_on_delivery')
        ? 'platform_collected'
        : 'pay_on_delivery';
      return { storeId: info.storeId, storeName: info.storeName, fee, method };
    });
    const platformCollectedTotal = perStore
      .filter((s) => s.method === 'platform_collected')
      .reduce((sum, s) => sum + s.fee, 0);
    const payOnDeliveryTotal = perStore
      .filter((s) => s.method === 'pay_on_delivery')
      .reduce((sum, s) => sum + s.fee, 0);
    const isMixedFulfillment = new Set(perStore.filter((s) => s.fee > 0).map((s) => s.method)).size > 1;
    return { platformCollectedTotal, payOnDeliveryTotal, perStore, isMixedFulfillment };
  }, [formData.state, storeDeliveryInfo]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const setVH = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      setVH();
      window.addEventListener('resize', setVH);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('resize', setVH);
      };
    }
  }, [isOpen]);

  // Initialize form data from customer
  useEffect(() => {
    if (isOpen && customer) {
      setFormData(prev => ({
        ...prev,
        phone: customer.phone || '',
        email: customer.email || '',
        // Support both camelCase and snake_case field names
        firstName: customer.firstName || customer.first_name || '',
        lastName: customer.lastName || customer.last_name || ''
      }));
    }
  }, [isOpen, customer]);

  // A stale error from a previous attempt must not persist into the next
  // time this modal opens.
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      setSubmitErrorOrderId(null);
    }
  }, [isOpen]);

  // Pre-fill delivery state from the buyer's already-set browse-time
  // preference (DeliveryStateContext) -- most of the time that's exactly
  // where they want this delivered too, and it's still a normal editable
  // field afterward, never locked. Only applied while the field is still
  // empty (never overwrites a value the customer already picked), and
  // only when it's actually among this checkout's valid options --
  // deliverableStates may restrict the dropdown to a subset, and setting
  // a value that isn't one of the options would look like a phantom
  // selection nothing in stateOptions actually matches.
  useEffect(() => {
    if (!isOpen || !deliveryState) return;
    if (!stateOptions.some((s) => s.value === deliveryState)) return;
    setFormData((prev) => (prev.state ? prev : { ...prev, state: deliveryState }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, deliveryState]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (name === "phone") {
      setWhatsAppValidated(false);
    }
    
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateWhatsAppNumber = async () => {
    if (!formData.phone || formData.phone.trim() === "") {
      setErrors(prev => ({ ...prev, phone: "Please enter a phone number" }));
      return;
    }

    setIsValidatingWhatsApp(true);
    setErrors(prev => ({ ...prev, phone: "" }));

    try {
      const formattedPhone = formData.phone.replace(/\s/g, "");
      const nigerianPhoneRegex = /^(\+234|0)[789]\d{9}$/;

      if (!nigerianPhoneRegex.test(formattedPhone)) {
        setErrors(prev => ({
          ...prev,
          phone: "Please enter a valid Nigerian phone number (e.g., 08012345678 or +2348012345678)"
        }));
        setIsValidatingWhatsApp(false);
        return;
      }

      setWhatsAppValidated(true);
      setErrors(prev => ({ ...prev, phone: "" }));
    } catch (error) {
      setErrors(prev => ({ ...prev, phone: "Failed to validate phone number" }));
    } finally {
      setIsValidatingWhatsApp(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!whatsAppValidated) {
      newErrors.phone = "Please validate your WhatsApp number first";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.street.trim()) newErrors.street = "Street address is required";
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.state.trim()) newErrors.state = "State is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitError(null);
    setSubmitErrorOrderId(null);
    setIsSubmitting(true);
    try {
      await onConfirm(formData);
    } catch (error) {
      console.error("Order submission error:", error);
      // onConfirm (handleStoreConfirmOrder in [slug]/cart/page.js) throws on
      // every failure path -- payment-readiness timeout, insufficient
      // stock, network errors -- and this was the only place any of that
      // reached the customer. Silently logging it made every one of those
      // failures look identical: the button spins, then goes back to
      // normal, with no indication anything went wrong or why.
      setSubmitError(error.message || "Failed to place order. Please try again.");
      // The duplicate-checkout guard's error carries the order it's
      // blocking on -- when present, offer a direct path to it instead of
      // just naming an order number in plain text with nothing to click.
      if (error.existingOrderId) setSubmitErrorOrderId(error.existingOrderId);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isPerStoreCheckout = !!storeGroup;
  const storeName = storeGroup?.storeSnapshot?.storeName || "Store";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{
        backgroundColor: 'rgba(8, 42, 32, 0.55)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{
          maxHeight: 'calc(var(--vh, 1vh) * 100)',
          height: 'auto',
          minHeight: '50vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header -- checkout is a Stora-processed payment either
            way (one vendor or several), so this stays brand-colored
            rather than switching to the vendor's own color per store. */}
        <div className="text-center p-4 sm:p-6 flex-shrink-0 sm:rounded-t-2xl bg-brand-50/70">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 bg-brand-100">
            <Package className="w-6 h-6 sm:w-8 sm:h-8 text-brand-700" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-brand-900 mb-1.5">
            {isPerStoreCheckout ? `Complete order for ${storeName}` : 'Complete your order'}
          </h2>
          <p className="text-sm sm:text-base text-brand-800/60">
            {isPerStoreCheckout
              ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} · ${formatPrice(totalAmount)}`
              : 'Provide delivery details to proceed'
            }
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            {/* Customer Name */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Customer name
              </label>
              <input
                type="text"
                value={`${customer?.firstName || customer?.first_name || ''} ${customer?.lastName || customer?.last_name || ''}`.trim()}
                disabled
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-lg sm:rounded-xl text-sm sm:text-base text-gray-900 bg-gray-50"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="your.email@example.com"
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600 text-sm sm:text-base text-gray-900 ${
                  errors.email ? "border-red-300" : "border-gray-300 bg-white"
                }`}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Order confirmation will be sent to this email
              </p>
            </div>

            {/* WhatsApp Phone Number */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                WhatsApp Phone Number *
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="08012345678"
                  disabled={whatsAppValidated || isSubmitting}
                  className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600 text-sm sm:text-base text-gray-900 ${
                    whatsAppValidated
                      ? "bg-green-50 border-green-300"
                      : "border-gray-300 bg-white"
                  } ${errors.phone ? "border-red-300" : ""}`}
                />
                {!whatsAppValidated ? (
                  <button
                    type="button"
                    onClick={validateWhatsAppNumber}
                    disabled={isValidatingWhatsApp || isSubmitting}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-medium bg-brand-700 hover:bg-brand-800 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {isValidatingWhatsApp ? "…" : "Validate"}
                  </button>
                ) : (
                  <div className="flex items-center px-3 sm:px-4 bg-green-50 border border-green-300 rounded-lg sm:rounded-xl flex-shrink-0">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                )}
              </div>
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.phone}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Ensure this is your WhatsApp number for order updates
              </p>
            </div>

            {/* Delivery Address Section */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-gray-500" />
                <h3 className="text-xs sm:text-sm font-semibold text-gray-900">
                  Delivery address
                </h3>
              </div>

              {/* Street Address */}
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Street Address *
                </label>
                <textarea
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="e.g., No. 15, Allen Avenue, Ikeja"
                  rows="2"
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white text-sm sm:text-base text-gray-900 resize-none ${
                    errors.street ? "border-red-300" : "border-gray-300"
                  }`}
                />
                {errors.street && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.street}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Include house number and street name
                </p>
              </div>

              {/* City */}
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  City/Town *
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="e.g., Ikeja, Lekki, Surulere"
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white text-sm sm:text-base text-gray-900 ${
                    errors.city ? "border-red-300" : "border-gray-300"
                  }`}
                />
                {errors.city && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.city}
                  </p>
                )}
              </div>

              {/* State */}
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  State *
                </label>
                {noCommonDeliveryState ? (
                  <div className="rounded-lg sm:rounded-xl border border-red-200 bg-red-50 px-3 sm:px-4 py-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-xs sm:text-sm">
                      These stores don&apos;t share a delivery region in common, so this cart can&apos;t be checked out together.
                      Close this and use each store&apos;s own &ldquo;Place order&rdquo; button to check out separately.
                    </p>
                  </div>
                ) : (
                  <>
                    <CustomDropdown
                      options={stateOptions}
                      value={formData.state}
                      onChange={(value) => handleChange({ target: { name: 'state', value } })}
                      placeholder="Select your state"
                      backgroundColor="#FFFFFF"
                      error={!!errors.state}
                    />
                    {errors.state && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.state}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1.5">
                      {Array.isArray(deliverableStates) && deliverableStates.length > 0
                        ? `Delivers to: ${deliverableStates.join(', ')}`
                        : 'Delivers nationwide'}
                    </p>
                  </>
                )}
              </div>

              {/* Landmark (Optional) */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Landmark (optional)
                </label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="e.g., Near GTBank, Opposite Shoprite"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white text-sm sm:text-base text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This helps the delivery person find you easily
                </p>
              </div>
            </div>

            {/* Order Summary -- shown for both checkout modes now (used to
                be per-store only, leaving the whole-cart flow's own inline
                modal to duplicate this same block instead of sharing it). */}
            <div className="bg-brand-50/60 border border-brand-100/70 rounded-xl p-3 sm:p-4 mt-4">
              <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-3">Order summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{itemCount}</span>
                </div>
                {storeCount > 1 && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Stores:</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{storeCount}</span>
                  </div>
                )}
                {commissionPassThrough > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Platform fee:</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{formatPrice(commissionPassThrough)}</span>
                  </div>
                )}
                {estimatedPaystackFee > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Payment processing fee:</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{formatPrice(estimatedPaystackFee)}</span>
                  </div>
                )}
                {deliveryBreakdown.platformCollectedTotal > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Delivery fee:</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{formatPrice(deliveryBreakdown.platformCollectedTotal)}</span>
                  </div>
                )}

                {/* Collapsible per-vendor breakdown -- only worth showing
                    when there's more than one store to disambiguate; a
                    single-store checkout has nothing to explain here (see
                    the plain inline sentence in the pay-on-arrival box
                    below instead). Reuses the same chevron-toggle idiom
                    already used for cart item details in
                    CartPageContent.js, not a new generic component. */}
                {deliveryBreakdown.perStore.length > 1 && (deliveryBreakdown.platformCollectedTotal > 0 || deliveryBreakdown.payOnDeliveryTotal > 0) && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDeliveryDetails((v) => !v)}
                      className="flex items-center gap-1 text-xs text-brand-700 font-medium hover:text-brand-800"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      {showDeliveryDetails ? "Hide delivery details" : "Show delivery details"}
                      {showDeliveryDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showDeliveryDetails && (
                      <div className="mt-2 pt-2 border-t border-dashed border-brand-200/70 space-y-1.5">
                        {deliveryBreakdown.perStore.map((s) => (
                          <div key={s.storeId} className="flex justify-between text-xs">
                            <span className="text-gray-600">{s.storeName}</span>
                            <span className="text-gray-700 font-medium">
                              {s.method === "pay_on_delivery" ? "Pay on arrival" : "Paid now"}
                              {s.fee > 0 && ` · ${formatPrice(s.fee)}`}
                            </span>
                          </div>
                        ))}
                        <p className="text-[11px] text-gray-500 pt-1">
                          Some vendors collect their delivery fee in cash/transfer on arrival instead of through this payment. Your item cost is always paid securely now — only the delivery portion for these vendors is collected on arrival.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-dashed border-brand-200/70 my-2"></div>
                <div className="flex justify-between items-end">
                  <span className="text-sm sm:text-base font-semibold text-gray-900">Total amount:</span>
                  <span className="text-lg sm:text-xl font-bold text-brand-800 tabular-nums">
                    {formatPrice(totalAmount + commissionPassThrough + estimatedPaystackFee + deliveryBreakdown.platformCollectedTotal)}
                  </span>
                </div>
              </div>

              {deliveryBreakdown.payOnDeliveryTotal > 0 && (
                <div className="mt-3 pt-3 border-t border-brand-100">
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Truck className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-xs sm:text-sm text-gray-700">
                        {deliveryBreakdown.perStore.length > 1
                          ? "Pay to rider(s) on arrival"
                          : "Pay to rider on arrival"}
                      </span>
                    </div>
                    <span className="text-sm sm:text-base font-bold text-gray-900 tabular-nums flex-shrink-0">
                      {formatPrice(deliveryBreakdown.payOnDeliveryTotal)}
                    </span>
                  </div>
                  {/* Single-store checkout has nothing to disambiguate --
                      one plain sentence instead of the multi-vendor
                      collapsible above. */}
                  {deliveryBreakdown.perStore.length <= 1 && (
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      This vendor collects their delivery fee in cash/transfer when your order arrives. Your item cost is always paid securely now.
                    </p>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50 sm:rounded-b-2xl flex-shrink-0">
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-600 text-sm">{submitError}</p>
                {submitErrorOrderId && onResumeExistingOrder && (
                  <button
                    type="button"
                    onClick={() => onResumeExistingOrder(submitErrorOrderId)}
                    className="text-red-700 text-sm font-semibold hover:underline mt-1"
                  >
                    Go to that order
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !whatsAppValidated || !formData.street || !formData.city || !formData.state || noCommonDeliveryState}
              className="w-full sm:flex-1 py-2.5 sm:py-3 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold bg-brand-700 hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Placing order…
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  Confirm order
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-3 sm:mt-4">
            {isPerStoreCheckout
              ? 'You’ll receive order confirmation on WhatsApp from this store'
              : 'You’ll receive order confirmations on WhatsApp from each store'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
