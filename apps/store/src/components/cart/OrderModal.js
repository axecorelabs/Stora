"use client";
import { useState, useEffect } from "react";
import { X, MapPin, Package, AlertCircle, CheckCircle } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function OrderModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  customer,
  storeGroup = null, // If provided, this is a per-store checkout
  totalAmount,
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

  const nigerianStates = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
    "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
    "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
    "Yobe", "Zamfara"
  ];

  const stateOptions = nigerianStates.map(state => ({ value: state, label: state }));

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

    setIsSubmitting(true);
    try {
      await onConfirm(formData);
    } catch (error) {
      console.error("Order submission error:", error);
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
        {/* Fixed Header */}
        <div 
          className="text-center p-4 sm:p-6 flex-shrink-0 sm:rounded-t-2xl"
          style={{ backgroundColor: `${primaryColor}10` }}
        >
          <div
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <Package className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            {isPerStoreCheckout ? `Complete Order for ${storeName}` : 'Complete Your Order'}
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            {isPerStoreCheckout 
              ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} • ${formatPrice(totalAmount)}`
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
                Customer Name
              </label>
              <input
                type="text"
                value={`${customer?.firstName || customer?.first_name || ''} ${customer?.lastName || customer?.last_name || ''}`.trim()}
                disabled
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-lg sm:rounded-xl text-sm sm:text-base text-gray-900"
                style={{ backgroundColor: secondaryColor }}
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
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 text-sm sm:text-base text-gray-900 ${
                  errors.email ? "border-red-300" : "border-gray-300 bg-white"
                }`}
                style={{ "--tw-ring-color": primaryColor }}
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
                  className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 text-sm sm:text-base text-gray-900 ${
                    whatsAppValidated
                      ? "bg-green-50 border-green-300"
                      : "border-gray-300 bg-white"
                  } ${errors.phone ? "border-red-300" : ""}`}
                  style={{ "--tw-ring-color": primaryColor }}
                />
                {!whatsAppValidated ? (
                  <button
                    type="button"
                    onClick={validateWhatsAppNumber}
                    disabled={isValidatingWhatsApp || isSubmitting}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {isValidatingWhatsApp ? "..." : "Validate"}
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
                  Delivery Address
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
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 bg-white text-sm sm:text-base text-gray-900 resize-none ${
                    errors.street ? "border-red-300" : "border-gray-300"
                  }`}
                  style={{ "--tw-ring-color": primaryColor }}
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
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 bg-white text-sm sm:text-base text-gray-900 ${
                    errors.city ? "border-red-300" : "border-gray-300"
                  }`}
                  style={{ "--tw-ring-color": primaryColor }}
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
              </div>

              {/* Landmark (Optional) */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="e.g., Near GTBank, Opposite Shoprite"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 bg-white text-sm sm:text-base text-gray-900"
                  style={{ "--tw-ring-color": primaryColor }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This helps the delivery person find you easily
                </p>
              </div>
            </div>

            {/* Order Summary for per-store checkout */}
            {isPerStoreCheckout && (
              <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 mt-4">
                <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-3">Order Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Items:</span>
                    <span className="font-semibold text-gray-900">{itemCount}</span>
                  </div>
                  <div className="border-t border-gray-200 my-2"></div>
                  <div className="flex justify-between">
                    <span className="text-sm sm:text-base font-semibold text-gray-900">Total Amount:</span>
                    <span className="text-lg sm:text-xl font-bold" style={{ color: primaryColor }}>
                      {formatPrice(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50 sm:rounded-b-2xl flex-shrink-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 border-2 border-gray-300 text-gray-700 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !whatsAppValidated || !formData.street || !formData.city || !formData.state}
              className="w-full sm:flex-1 py-2.5 sm:py-3 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Placing Order...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  Confirm Order
                </>
              )}
            </button>
          </div>
          
          <p className="text-xs text-gray-500 text-center mt-3 sm:mt-4">
            {isPerStoreCheckout 
              ? 'You will receive order confirmation on WhatsApp from this store'
              : 'You will receive order confirmations on WhatsApp from each store'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
