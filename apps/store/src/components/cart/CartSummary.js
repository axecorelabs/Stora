"use client";

import { CheckCircle } from "lucide-react";

export default function CartSummary({
  cart,
  formatPrice,
  onPlaceOrder,
  primaryColor,
  isMobile
}) {
  return (
    <div className={`bg-white rounded-xl md:rounded-2xl border border-gray-100 overflow-hidden ${!isMobile && "sticky top-24"}`}>
      <div className="p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Order Summary</h2>

        <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm md:text-base text-gray-600">Subtotal</span>
            <span className="text-base md:text-lg font-semibold text-gray-900">
              {formatPrice(cart.subtotal || 0)}
            </span>
          </div>

          {cart.discount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm md:text-base text-gray-600">Discount</span>
              <span className="text-base md:text-lg font-semibold text-red-600">
                -{formatPrice(cart.discount)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm md:text-base text-gray-600">Delivery Fee</span>
            <span className="text-base md:text-lg font-semibold text-gray-900">
              {formatPrice(cart.shipping || 0)}
            </span>
          </div>

          <div className="border-t border-gray-200 pt-3 md:pt-4">
            <div className="flex items-center justify-between">
              <span className="text-base md:text-lg font-semibold text-gray-900">Total</span>
              <span className="text-xl md:text-2xl font-bold" style={{ color: primaryColor }}>
                {formatPrice(cart.total || 0)}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onPlaceOrder}
          className="w-full py-3 md:py-4 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-base md:text-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
          Place Order
        </button>
      </div>
    </div>
  );
}
