"use client";
import { useState, useMemo } from "react";
import { X, Plus, Minus, ShoppingCart, Package, AlertCircle } from "lucide-react";

export default function VariantSelectionModal({ isOpen, onClose, item, onAddToCart }) {
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Always call hooks - Group variants by color
  const variantsByColor = useMemo(() => {
    if (!item || !item.variants || item.variants.length === 0) return {};
    
    return item.variants.reduce((acc, variant) => {
      if (!acc[variant.color]) {
        acc[variant.color] = [];
      }
      acc[variant.color].push(variant);
      return acc;
    }, {});
  }, [item]);

  // Always call hooks - Get available sizes for selected color
  const availableSizes = useMemo(() => {
    if (!selectedColor || !variantsByColor[selectedColor]) return [];
    return variantsByColor[selectedColor]?.map(v => ({
      size: v.size,
      stock: v.quantityInStock,
      sku: v.sku
    })) || [];
  }, [selectedColor, variantsByColor]);

  // Always call hooks - Get selected variant
  const selectedVariant = useMemo(() => {
    if (!item || !selectedSize || !selectedColor) return null;
    return item.variants?.find(v => v.size === selectedSize && v.color === selectedColor) || null;
  }, [selectedSize, selectedColor, item]);

  // Early return after all hooks
  if (!isOpen || !item) return null;

  // Get max quantity available
  const maxQuantity = selectedVariant ? selectedVariant.quantityInStock : 0;

  // Handle quantity change
  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 1) return;
    if (newQuantity > maxQuantity) return;
    setQuantity(newQuantity);
  };

  // Handle add to cart
  const handleAddToCart = () => {
    if (!selectedVariant) {
      alert('Please select both size and color');
      return;
    }

    if (quantity > selectedVariant.quantityInStock) {
      alert('Insufficient stock for this variant');
      return;
    }

    // Create cart item with variant info
    const cartItem = {
      ...item,
      variant: {
        size: selectedSize,
        color: selectedColor,
        sku: selectedVariant.sku,
        variantId: selectedVariant._id
      },
      quantity: quantity,
      displayName: `${item.productName} (${selectedColor} - ${selectedSize})`,
      availableStock: selectedVariant.quantityInStock
    };

    onAddToCart(cartItem);
    
    // Reset and close
    setSelectedSize('');
    setSelectedColor('');
    setQuantity(1);
    onClose();
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <Package className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Select Variant</h2>
              <p className="text-sm text-gray-500">{item.productName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Product Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center space-x-4">
              {item.image && (
                <div className="w-20 h-20 bg-white rounded-lg overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.productName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{item.productName}</h3>
                <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                <p className="text-lg font-bold text-teal-600 mt-1">
                  {formatCurrency(item.sellingPrice)}
                </p>
              </div>
            </div>
          </div>

          {/* Color Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Color *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {Object.keys(variantsByColor).map(color => {
                const totalStock = variantsByColor[color].reduce((sum, v) => sum + v.quantityInStock, 0);
                const isOutOfStock = totalStock === 0;
                
                return (
                  <button
                    key={color}
                    onClick={() => {
                      if (!isOutOfStock) {
                        setSelectedColor(color);
                        setSelectedSize(''); // Reset size when color changes
                        setQuantity(1);
                      }
                    }}
                    disabled={isOutOfStock}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedColor === color
                        ? 'border-teal-500 bg-teal-50'
                        : isOutOfStock
                        ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                        : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: color.toLowerCase() }}
                      />
                      <span className="font-medium text-gray-900">{color}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {isOutOfStock ? 'Out of stock' : `${totalStock} available`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size Selection */}
          {selectedColor && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Size *
              </label>
              <div className="grid grid-cols-4 gap-3">
                {availableSizes.map(({ size, stock, sku }) => {
                  const isOutOfStock = stock === 0;
                  
                  return (
                    <button
                      key={sku}
                      onClick={() => {
                        if (!isOutOfStock) {
                          setSelectedSize(size);
                          setQuantity(1);
                        }
                      }}
                      disabled={isOutOfStock}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${
                        selectedSize === size
                          ? 'border-teal-500 bg-teal-50'
                          : isOutOfStock
                          ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                          : 'border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      <span className={`font-semibold block mb-1 ${
                        selectedSize === size ? 'text-teal-900' : 'text-gray-900'
                      }`}>
                        {size}
                      </span>
                      <span className="text-xs text-gray-500 block">
                        {isOutOfStock ? 'Out' : `${stock} left`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Selection */}
          {selectedVariant && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Quantity
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3 bg-gray-50 rounded-xl p-2">
                  <button
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1}
                    className="p-2 text-gray-500 hover:text-teal-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                    min="1"
                    max={maxQuantity}
                    className="w-20 text-center text-lg font-semibold bg-transparent border-0 focus:outline-none text-gray-900"
                  />
                  <button
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={quantity >= maxQuantity}
                    className="p-2 text-gray-500 hover:text-teal-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    Available: <span className="font-semibold text-gray-900">{maxQuantity}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    SKU: {selectedVariant.sku}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selection Summary */}
          {selectedVariant && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-teal-900 mb-1">
                    Selected: {selectedColor} - {selectedSize}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-teal-700">
                      {quantity} × {formatCurrency(item.sellingPrice)}
                    </p>
                    <p className="text-lg font-bold text-teal-900">
                      {formatCurrency(quantity * item.sellingPrice)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Low Stock Warning */}
          {selectedVariant && selectedVariant.quantityInStock <= selectedVariant.reorderLevel && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Low Stock Alert</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Only {selectedVariant.quantityInStock} units left for this variant
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-white transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant}
              className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Add to Cart</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
