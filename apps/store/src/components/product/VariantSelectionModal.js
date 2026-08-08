'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart, Check, Trash2 } from 'lucide-react';
import Image from 'next/image';

export default function VariantSelectionModal({ 
  isOpen, 
  onClose, 
  product, 
  onAddToCart,
  primaryColor = '#0D9488' 
}) {
  const [selectedVariants, setSelectedVariants] = useState([]);
  const [currentSelection, setCurrentSelection] = useState({
    color: '',
    size: '',
    quantity: 1
  });

  // Get unique colors and sizes
  // Handle different variant data structures
  let variants = [];
  if (Array.isArray(product.variants)) {
    variants = product.variants;
  } else if (product.variants && typeof product.variants === 'object') {
    // If variants is an object, try to extract array from it
    variants = Object.values(product.variants);
  }
  
  // Debug logging
  console.log('[VariantModal] Product:', product.productName);
  console.log('[VariantModal] Has variants:', !!product.variants);
  console.log('[VariantModal] Variants type:', typeof product.variants);
  console.log('[VariantModal] Variants data:', product.variants);
  console.log('[VariantModal] Processed variants array:', variants);
  console.log('[VariantModal] First variant sample:', variants[0]);
  
  const availableColors = variants.length > 0
    ? [...new Set(variants
        .filter(v => v && (v.isActive !== false && v.is_active !== false))
        .map(v => v.color)
        .filter(Boolean))]
    : [];

  const availableSizesForColor = variants.length > 0
    ? [...new Set(variants
        .filter(v => v && (v.isActive !== false && v.is_active !== false) && (!currentSelection.color || v.color === currentSelection.color))
        .map(v => v.size)
        .filter(Boolean))]
    : [];
  
  console.log('[VariantModal] Available colors:', availableColors);
  console.log('[VariantModal] Available sizes for color:', availableSizesForColor);

  // Get variant stock info
  const getVariantStock = (color, size) => {
    if (variants.length === 0) return 0;
    const variant = variants.find(v => 
      v.color === color && v.size === size && (v.isActive || v.is_active)
    );
    return variant?.quantityInStock || variant?.quantity_in_stock || 0;
  };

  // Get variant info
  const getVariantInfo = (color, size) => {
    if (variants.length === 0) return null;
    return variants.find(v => 
      v.color === color && v.size === size && (v.isActive || v.is_active)
    );
  };

  // Get image for color - FIXED to check both images array and single image
  const getColorImage = (color) => {
    // First check images array for color-tagged image
    if (product.images && product.images.length > 0) {
      const colorImage = product.images.find(img => img.colorTag === color);
      if (colorImage?.url) return colorImage.url;
      
      // Fallback to first image in array
      if (product.images[0]?.url) return product.images[0].url;
    }
    
    // Final fallback to main image
    return product.image || '/placeholder-product.jpg';
  };

  // Calculate total quantity already selected for this variant
  const getSelectedQuantity = (color, size) => {
    return selectedVariants
      .filter(v => v.color === color && v.size === size)
      .reduce((sum, v) => sum + v.quantity, 0);
  };

  // Check if variant is available
  const isVariantAvailable = (color, size, quantity = 1) => {
    const stock = getVariantStock(color, size);
    const alreadySelected = getSelectedQuantity(color, size);
    return stock >= (alreadySelected + quantity);
  };

  // Handle add to selection
  const handleAddToSelection = () => {
    if (!currentSelection.color || !currentSelection.size || currentSelection.quantity < 1) {
      return;
    }

    if (!isVariantAvailable(currentSelection.color, currentSelection.size, currentSelection.quantity)) {
      alert('Not enough stock available');
      return;
    }

    const variantInfo = getVariantInfo(currentSelection.color, currentSelection.size);
    const colorImage = getColorImage(currentSelection.color);
    
    const newVariant = {
      ...currentSelection,
      variantId: variantInfo._id,
      sku: variantInfo.sku,
      image: colorImage, // Ensure we're getting the correct image
      availableStock: getVariantStock(currentSelection.color, currentSelection.size)
    };

    setSelectedVariants([...selectedVariants, newVariant]);
    
    // Reset current selection
    setCurrentSelection({
      color: '',
      size: '',
      quantity: 1
    });
  };

  // Remove from selection
  const handleRemoveVariant = (index) => {
    setSelectedVariants(selectedVariants.filter((_, i) => i !== index));
  };

  // Update quantity in selection
  const handleUpdateQuantity = (index, newQuantity) => {
    const variant = selectedVariants[index];
    const otherSelectedQty = selectedVariants
      .filter((v, i) => i !== index && v.color === variant.color && v.size === variant.size)
      .reduce((sum, v) => sum + v.quantity, 0);
    
    const maxAvailable = variant.availableStock - otherSelectedQty;
    
    if (newQuantity < 1 || newQuantity > maxAvailable) return;

    const updated = [...selectedVariants];
    updated[index] = { ...updated[index], quantity: newQuantity };
    setSelectedVariants(updated);
  };

  // Calculate totals
  const totalItems = selectedVariants.reduce((sum, v) => sum + v.quantity, 0);
  const totalPrice = totalItems * product.sellingPrice;

  const formatPrice = (price) => {
    return `₦${price?.toLocaleString()}`;
  };

  // Handle final add to cart
  const handleFinalAddToCart = () => {
    if (selectedVariants.length === 0) return;
    
    onAddToCart(selectedVariants);
    setSelectedVariants([]);
    setCurrentSelection({ color: '', size: '', quantity: 1 });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="flex items-end sm:items-center justify-center w-full h-full sm:h-auto">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-white-900 bg-opacity-75 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal panel - Mobile optimized with proper scrolling */}
        <div 
          className="w-full sm:max-w-4xl overflow-hidden text-left transition-all transform bg-white shadow-xl sm:rounded-2xl rounded-t-3xl relative z-10 h-screen sm:h-auto max-h-screen sm:max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Sticky on top */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Customize Your Order</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Choose color, size, and quantity for each item</p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                type="button"
                aria-label="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Content - Scrollable area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 overscroll-contain">
            {/* Product Info - Compact on mobile */}
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-xl">
              <Image
                src={product.image || '/placeholder-product.jpg'}
                alt={product.productName}
                width={60}
                height={60}
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{product.productName}</h4>
                <p className="text-base sm:text-lg font-bold mt-1" style={{ color: primaryColor }}>
                  {formatPrice(product.sellingPrice)} per item
                </p>
              </div>
            </div>

            {/* Current Selection Form - Mobile optimized */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Add Item</h4>
              
              <div className="space-y-4">
                {/* Color Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Select Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setCurrentSelection({ ...currentSelection, color, size: '' })}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                          currentSelection.color === color
                            ? 'bg-gray-900 text-white shadow-lg scale-105'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size Selection */}
                {currentSelection.color && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Select Size
                    </label>
                    <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                      {availableSizesForColor.map((size) => {
                        const stock = getVariantStock(currentSelection.color, size);
                        const alreadySelected = getSelectedQuantity(currentSelection.color, size);
                        const available = stock - alreadySelected;
                        const isAvailable = available > 0;
                        
                        return (
                          <button
                            key={size}
                            onClick={() => isAvailable && setCurrentSelection({ ...currentSelection, size })}
                            disabled={!isAvailable}
                            className={`relative px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                              currentSelection.size === size
                                ? 'bg-gray-900 text-white shadow-lg scale-105'
                                : isAvailable
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
                                : 'bg-gray-50 text-gray-400 cursor-not-allowed line-through'
                            }`}
                          >
                            {size}
                            {isAvailable && (
                              <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-green-500 text-white text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded-full font-bold">
                                {available}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity Selection */}
                {currentSelection.color && currentSelection.size && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Quantity
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex items-center bg-gray-50 border-2 border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setCurrentSelection({ 
                            ...currentSelection, 
                            quantity: Math.max(1, currentSelection.quantity - 1) 
                          })}
                          className="px-3 sm:px-4 py-3 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        >
                          <Minus className="w-4 h-4 text-gray-700" />
                        </button>
                        <input
                          type="number"
                          value={currentSelection.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            const maxAvail = getVariantStock(currentSelection.color, currentSelection.size) - 
                              getSelectedQuantity(currentSelection.color, currentSelection.size);
                            setCurrentSelection({ 
                              ...currentSelection, 
                              quantity: Math.max(1, Math.min(maxAvail, val))
                            });
                          }}
                          className="w-16 sm:w-20 text-center text-base sm:text-lg font-bold text-gray-900 bg-transparent focus:outline-none"
                          min="1"
                        />
                        <button
                          onClick={() => {
                            const maxAvail = getVariantStock(currentSelection.color, currentSelection.size) - 
                              getSelectedQuantity(currentSelection.color, currentSelection.size);
                            setCurrentSelection({ 
                              ...currentSelection, 
                              quantity: Math.min(maxAvail, currentSelection.quantity + 1)
                            });
                          }}
                          className="px-3 sm:px-4 py-3 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        >
                          <Plus className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                      <button
                        onClick={handleAddToSelection}
                        disabled={!currentSelection.color || !currentSelection.size}
                        className="flex-1 sm:flex-none px-4 sm:px-6 py-3 bg-gray-900 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-gray-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add to Selection</span>
                        <span className="sm:hidden">Add</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Variants List - IMPROVED with trash icon */}
            {selectedVariants.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: primaryColor }} />
                  Your Selection ({selectedVariants.length} {selectedVariants.length === 1 ? 'item' : 'items'})
                </h4>
                <div className="space-y-3">
                  {selectedVariants.map((variant, index) => (
                    <div
                      key={index}
                      className="relative bg-gray-50 rounded-lg border-2 border-gray-200 overflow-hidden"
                    >
                      {/* Trash Icon - Top Right */}
                      <button
                        onClick={() => handleRemoveVariant(index)}
                        className="absolute top-2 right-2 z-10 p-1.5 sm:p-2 bg-white text-red-500 hover:bg-red-50 active:bg-red-100 rounded-lg shadow-sm transition-colors border border-gray-200"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </button>

                      {/* Mobile Layout: Stack vertically */}
                      <div className="flex flex-col sm:flex-row sm:items-center p-3 sm:p-4 gap-3 pr-12">
                        {/* Image and Info Row */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="relative flex-shrink-0">
                            <Image
                              src={variant.image || '/placeholder-product.jpg'}
                              alt={`${variant.color} ${variant.size}`}
                              width={64}
                              height={64}
                              className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg"
                              onError={(e) => {
                                e.target.src = '/placeholder-product.jpg';
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                              <span className="px-2.5 py-1 bg-white text-gray-800 text-xs font-medium rounded-md border border-gray-300 shadow-sm">
                                {variant.color}
                              </span>
                              <span className="px-2.5 py-1 bg-white text-gray-800 text-xs font-medium rounded-md border border-gray-300 shadow-sm">
                                {variant.size}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">SKU: {variant.sku}</p>
                          </div>
                        </div>

                        {/* Controls Row - Full width on mobile */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                          {/* Quantity Controls */}
                          <div className="flex items-center bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <button
                              onClick={() => handleUpdateQuantity(index, variant.quantity - 1)}
                              className="px-3 py-2 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-700" />
                            </button>
                            <span className="px-3 sm:px-4 py-2 text-gray-900 font-bold text-sm sm:text-base min-w-[40px] text-center">
                              {variant.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(index, variant.quantity + 1)}
                              className="px-3 py-2 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-700" />
                            </button>
                          </div>

                          {/* Price */}
                          <div className="flex items-center">
                            <p className="font-bold text-gray-900 text-sm sm:text-base whitespace-nowrap">
                              {formatPrice(product.sellingPrice * variant.quantity)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer - Sticky at bottom */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4 sm:p-6 bg-white shadow-lg">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Items</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalItems}</p>
              </div>
              <div className="text-right">
                <p className="text-xs sm:text-sm text-gray-600">Order Total</p>
                <p className="text-xl sm:text-2xl font-bold" style={{ color: primaryColor }}>
                  {formatPrice(totalPrice)}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={onClose}
                className="order-2 sm:order-1 flex-1 px-4 sm:px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 active:bg-gray-200 transition-all text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalAddToCart}
                disabled={selectedVariants.length === 0}
                className="order-1 sm:order-2 flex-1 px-4 sm:px-6 py-3 sm:py-4 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-lg active:scale-95 text-sm sm:text-base"
                style={{ backgroundColor: primaryColor }}
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                {selectedVariants.length > 0 
                  ? `Add ${totalItems} ${totalItems === 1 ? 'Item' : 'Items'} to Cart`
                  : 'Add to Cart'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
