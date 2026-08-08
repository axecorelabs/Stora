"use client";
import { useState } from "react";
import { X, Plus, Minus, ShoppingCart, Heart, MapPin, Tag, Package } from "lucide-react";

export default function ProductDetailsModal({ 
  isOpen, 
  onClose, 
  product, 
  primaryColor,
  secondaryColor,
  currency,
  onAddToCart 
}) {
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [liked, setLiked] = useState(false);

  if (!isOpen || !product) return null;

  const maxQuantity = product.quantityInStock || 0;
  const isOutOfStock = maxQuantity === 0;
  const isLowStock = maxQuantity > 0 && maxQuantity <= product.reorderLevel;

  const formatPrice = (price) => {
    if (currency === 'NGN') {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
  };

  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 1) return;
    if (newQuantity > maxQuantity) {
      setQuantity(maxQuantity);
      return;
    }
    setQuantity(newQuantity);
  };

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    
    const cartItem = {
      product: product,
      quantity: quantity,
      totalPrice: product.sellingPrice * quantity
    };

    try {
      await onAddToCart(cartItem);
      // Reset quantity after adding
      setQuantity(1);
      // Show success message or close modal
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error("Error adding to cart:", error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const totalPrice = product.sellingPrice * quantity;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Product Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Two Column Layout - Flex on large screens, Grid on small */}
        <div className="grid grid-cols-1 md:flex gap-8 p-6">
          {/* Left Column: Image & Stats - 50% on large screens */}
          <div className="md:w-1/2 md:flex-shrink-0 space-y-4">
            <div 
              className="relative w-full max-w-sm mx-auto aspect-square rounded-2xl overflow-hidden"
              style={{ backgroundColor: secondaryColor || '#F3F4F6' }}
            >
              {product.image ? (
                <img 
                  src={product.image} 
                  alt={product.productName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-8xl">📦</span>
                </div>
              )}

              {/* Stock Badge */}
              {isOutOfStock && (
                <div className="absolute top-4 left-4 bg-red-600 text-white text-sm font-semibold px-3 py-1.5 rounded-full">
                  Out of Stock
                </div>
              )}
              {isLowStock && (
                <div className="absolute top-4 left-4 bg-yellow-500 text-white text-sm font-semibold px-3 py-1.5 rounded-full">
                  Only {maxQuantity} left
                </div>
              )}

              {/* Wishlist Button */}
              <button
                onClick={() => setLiked(!liked)}
                className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              >
                <Heart 
                  className={`w-6 h-6 ${liked ? 'fill-current' : ''}`}
                  style={liked ? { color: primaryColor } : { color: '#6B7280' }}
                  strokeWidth={liked ? 0 : 2}
                  fill={liked ? primaryColor : 'none'}
                />
              </button>
            </div>

            {/* Product Stats */}
            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Package className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                <p className="text-xs text-gray-600">In Stock</p>
                <p className="text-sm font-semibold text-gray-900">{maxQuantity}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Tag className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Category</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{product.category}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <MapPin className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Location</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{product.location || 'Store'}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Details - 50% on large screens */}
          <div className="md:w-1/2 md:flex-shrink-0 flex flex-col space-y-6">
            {/* Product Name & SKU */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {product.productName}
              </h3>
              <p className="text-sm text-gray-600">
                SKU: {product.sku || 'N/A'}
              </p>
            </div>

            {/* Price */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Price</p>
              <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                {formatPrice(product.sellingPrice)}
              </p>
              {product.costPrice && product.costPrice < product.sellingPrice && (
                <p className="text-sm text-gray-500 line-through mt-1">
                  {formatPrice(product.costPrice)}
                </p>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Description</p>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                  {product.description}
                </p>
              </div>
            )}

            {/* Quantity Selector */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Quantity</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
                  <button
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1 || isOutOfStock}
                    className="px-4 py-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                    disabled={isOutOfStock}
                    className="w-16 text-center text-gray-900 font-semibold focus:outline-none"
                    min="1"
                    max={maxQuantity}
                  />
                  <button
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={quantity >= maxQuantity || isOutOfStock}
                    className="px-4 py-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  {maxQuantity} available
                </p>
              </div>
            </div>

            {/* Total Price */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Price</span>
                <span className="text-2xl font-bold text-gray-900">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-auto">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAddingToCart}
                className="w-full py-4 rounded-xl text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                {isAddingToCart ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding to Cart...
                  </>
                ) : isOutOfStock ? (
                  'Out of Stock'
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full py-4 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
