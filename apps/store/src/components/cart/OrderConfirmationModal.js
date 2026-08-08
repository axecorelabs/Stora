"use client";

import { ShoppingBag, CheckCircle, AlertCircle } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function OrderConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  customer,
  shippingAddress,
  onAddressChange,
  whatsAppValidated,
  isValidatingWhatsApp,
  onValidateWhatsApp,
  isPlacingOrder,
  orderError,
  cartCount,
  storeCount,
  totalAmount,
  formatPrice,
  primaryColor,
  secondaryColor,
  stateOptions
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
      <div className="bg-white rounded-2xl max-w-md max-h-[90dvh] w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="text-center p-6 flex-shrink-0" style={{ backgroundColor: `${primaryColor}10` }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}20` }}>
            <ShoppingBag className="w-8 h-8" style={{ color: primaryColor }} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Order</h3>
          <p className="text-gray-600">Provide delivery details to proceed</p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Customer Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name</label>
              <input
                type="text"
                value={`${customer?.firstName} ${customer?.lastName}`}
                disabled
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900"
                style={{ backgroundColor: secondaryColor }}
              />
            </div>

            {/* WhatsApp Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Phone Number *</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  name="phone"
                  value={shippingAddress.phone}
                  onChange={onAddressChange}
                  placeholder="08012345678"
                  disabled={whatsAppValidated}
                  className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 text-gray-900 ${
                    whatsAppValidated ? "bg-green-50 border-green-300" : "border-gray-300 bg-white"
                  }`}
                  style={{ "--tw-ring-color": primaryColor }}
                />
                {!whatsAppValidated ? (
                  <button
                    onClick={onValidateWhatsApp}
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
              <p className="text-xs text-gray-500 mt-1">Ensure this is your WhatsApp number</p>
            </div>

            {/* Delivery Address */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Delivery Address</h4>
              
              <div className="space-y-4">
                {/* Street */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Street Address *</label>
                  <textarea
                    name="street"
                    value={shippingAddress.street}
                    onChange={onAddressChange}
                    placeholder="e.g., No. 15, Allen Avenue"
                    rows="2"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 bg-white text-gray-900 resize-none"
                    style={{ "--tw-ring-color": primaryColor }}
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City/Town *</label>
                  <input
                    type="text"
                    name="city"
                    value={shippingAddress.city}
                    onChange={onAddressChange}
                    placeholder="e.g., Ikeja, Lekki"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 bg-white text-gray-900"
                    style={{ "--tw-ring-color": primaryColor }}
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                  <CustomDropdown
                    options={stateOptions}
                    value={shippingAddress.state}
                    onChange={(value) => onAddressChange({ target: { name: "state", value } })}
                    placeholder="Select your state"
                    backgroundColor="#FFFFFF"
                    error={false}
                  />
                </div>

                {/* Landmark */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Landmark (Optional)</label>
                  <input
                    type="text"
                    name="landmark"
                    value={shippingAddress.landmark || ""}
                    onChange={onAddressChange}
                    placeholder="e.g., Near GTBank"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 bg-white text-gray-900"
                    style={{ "--tw-ring-color": primaryColor }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 rounded-xl p-4 my-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-semibold text-gray-900">{cartCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Stores:</span>
                <span className="font-semibold text-gray-900">{storeCount}</span>
              </div>
              <div className="border-t border-gray-200 my-2"></div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total Amount:</span>
                <span className="text-xl font-bold" style={{ color: primaryColor }}>
                  {formatPrice(totalAmount)}
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

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isPlacingOrder}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isPlacingOrder || !whatsAppValidated || !shippingAddress.street || !shippingAddress.city || !shippingAddress.state}
              className="flex-1 py-3 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {isPlacingOrder ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Placing...
                </>
              ) : (
                "Confirm Order"
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-4">
            You will receive order confirmations on WhatsApp
          </p>
        </div>
      </div>
    </div>
  );
}
