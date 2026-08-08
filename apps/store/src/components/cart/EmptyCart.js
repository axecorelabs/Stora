"use client";

import { ShoppingBag } from "lucide-react";

export default function EmptyCart({ onContinueShopping, primaryColor }) {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
      <div className="text-center max-w-md mx-auto">
        <div className="text-8xl mb-6">🛒</div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Your Cart is Empty</h2>
        <p className="text-gray-600 mb-8">
          Looks like you haven't added anything to your cart yet. Start shopping to fill it up!
        </p>
        <button
          onClick={onContinueShopping}
          className="inline-flex items-center gap-2 px-8 py-4 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          <ShoppingBag className="w-5 h-5" />
          Start Shopping
        </button>
      </div>
    </div>
  );
}
