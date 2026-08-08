"use client";

import { ArrowLeft, ShoppingBag } from "lucide-react";

export default function CartHeader({ onBack, storeName, cartCount, showBreadcrumb = true, isMobile }) {
  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1 md:gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium text-sm md:text-base truncate max-w-[120px] md:max-w-none">
                {storeName || "Home"}
              </span>
            </button>
            {showBreadcrumb && !isMobile && (
              <>
                <span className="text-gray-300">›</span>
                <span className="font-medium text-gray-900">Cart</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
            <span className="font-semibold text-gray-900 text-sm md:text-base">
              {cartCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
