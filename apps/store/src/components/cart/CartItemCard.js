"use client";

import { useState } from 'react';
import { Trash2, Plus, Minus, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import Image from 'next/image';

export default function CartItemCard({
  item,
  onQuantityChange,
  onRemove,
  isUpdating,
  formatPrice,
  isMobile = false,
  primaryColor = '#0D9488',
  secondaryColor = '#F3F4F6'
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const itemId = item.id;
  // Priority: variant image > product_data > product_snapshot > images array
  const itemImage = item.variant?.image || 
                    item.product_data?.primary_image || 
                    item.product_snapshot?.primary_image ||
                    (item.product_snapshot?.images && item.product_snapshot.images.length > 0 ? item.product_snapshot.images[0] : null);
  const hasExtraDetails = item.variant || item.notes;

  return (
    <div className="p-3 md:p-6 relative">
      <div className="flex gap-2 md:gap-4">
        {/* Product Image */}
        <div className="flex-shrink-0">
          <div
            className={`${isMobile ? 'w-20 h-20' : 'w-32 h-32'} rounded-lg md:rounded-xl overflow-hidden relative`}
            style={{ backgroundColor: secondaryColor }}
          >
            {itemImage ? (
              <img
                src={itemImage}
                alt={item.product_snapshot?.product_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${isMobile ? 'text-2xl' : 'text-4xl'}`}>
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
              {/* Variant Quick Preview */}
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
              onClick={() => onRemove(item.product_id)}
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
                onClick={() => onQuantityChange(item.product_id, item.quantity - 1)}
                disabled={item.quantity <= 1 || isUpdating}
                className="px-2 md:px-4 py-1.5 md:py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </button>
              <span className="px-3 md:px-6 py-1.5 md:py-2 font-semibold text-gray-900 min-w-[40px] md:min-w-[60px] text-center text-sm md:text-base">
                {item.quantity}
              </span>
              <button
                onClick={() => onQuantityChange(item.product_id, item.quantity + 1)}
                disabled={isUpdating}
                className="px-2 md:px-4 py-1.5 md:py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </button>
            </div>

            {isUpdating && (
              <span className="text-xs md:text-sm text-gray-500">Updating...</span>
            )}
          </div>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      {hasExtraDetails && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute bottom-3 right-3 md:bottom-6 md:right-6 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors bg-white px-3 py-1.5 rounded-lg shadow-sm"
        >
          <span className="font-medium">
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Expanded Details Section */}
      {isExpanded && hasExtraDetails && (
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
          {item.product_snapshot && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Product Details
              </h4>
              <div className="space-y-1 text-sm">
                {item.product_snapshot.brand && (
                  <div>
                    <span className="text-gray-500">Brand:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {item.product_snapshot.brand}
                    </span>
                  </div>
                )}
                {item.product_snapshot.unit_of_measure && (
                  <div>
                    <span className="text-gray-500">Unit:</span>
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
              <p className="text-sm text-amber-800">{item.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
