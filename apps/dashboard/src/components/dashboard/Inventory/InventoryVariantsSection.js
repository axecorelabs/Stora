"use client";
import { useState } from "react";
import { Package, Eye, ChevronDown, ChevronUp, Image as ImageIcon, AlertCircle } from "lucide-react";

export default function InventoryVariantsSection({ item, formatCurrency }) {
  const [expandedVariants, setExpandedVariants] = useState({});

  const toggleVariantExpanded = (variantId) => {
    setExpandedVariants(prev => ({
      ...prev,
      [variantId]: !prev[variantId]
    }));
  };

  // Group variants by color
  const groupedVariants = item.variants.reduce((groups, variant) => {
    const color = variant.color || 'Unspecified';
    if (!groups[color]) {
      groups[color] = [];
    }
    groups[color].push(variant);
    return groups;
  }, {});

  // Calculate totals
  const totalVariantStock = item.variants.reduce((sum, v) => sum + (v.quantityInStock || 0), 0);
  const totalVariantsSold = item.variants.reduce((sum, v) => sum + (v.soldQuantity || 0), 0);
  const lowStockVariants = item.variants.filter(v => v.quantityInStock <= v.reorderLevel && v.isActive);
  const outOfStockVariants = item.variants.filter(v => v.quantityInStock === 0 && v.isActive);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-6">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Product Variants</h3>
              <p className="text-sm text-gray-500">
                {item.variants.length} variant{item.variants.length !== 1 ? 's' : ''} • {Object.keys(groupedVariants).length} color{Object.keys(groupedVariants).length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50/50">
        <div>
          <p className="text-xs text-gray-500 mb-1">Total Stock</p>
          <p className="text-lg font-semibold text-gray-900">{totalVariantStock}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Total Sold</p>
          <p className="text-lg font-semibold text-gray-900">{totalVariantsSold}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Low Stock</p>
          <p className="text-lg font-semibold text-amber-600">{lowStockVariants.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Out of Stock</p>
          <p className="text-lg font-semibold text-red-600">{outOfStockVariants.length}</p>
        </div>
      </div>

      {/* Variants List by Color - Two Column Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(groupedVariants).map(([color, variants]) => (
            <div key={color} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Color Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: color.toLowerCase() }}
                    title={color}
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{color}</h4>
                    <p className="text-xs text-gray-500">
                      {variants.length} size{variants.length !== 1 ? 's' : ''} • 
                      {variants.reduce((sum, v) => sum + v.quantityInStock, 0)} in stock
                    </p>
                  </div>
                  <div className="text-sm text-gray-600">
                    {variants.reduce((sum, v) => sum + v.soldQuantity, 0)} sold
                  </div>
                </div>
              </div>

              {/* Sizes for this color */}
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {variants.map((variant, variantIndex) => (
                  <div key={variant._id || `${color}-${variant.size}-${variantIndex}`} className="bg-white">
                    {/* Variant Row */}
                    <button
                      type="button"
                      onClick={() => toggleVariantExpanded(variant._id || `${color}-${variant.size}-${variantIndex}`)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        {/* Size Badge */}
                        <div className="flex items-center space-x-2">
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                            {variant.size}
                          </span>
                          {!variant.isActive && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                              Inactive
                            </span>
                          )}
                        </div>

                        {/* Stock Info */}
                        <div className="flex items-center space-x-4 text-sm">
                          <div>
                            <span className="text-gray-500">Stock:</span>
                            <span className={`ml-1 font-medium ${
                              variant.quantityInStock === 0 ? 'text-red-600' :
                              variant.quantityInStock <= variant.reorderLevel ? 'text-amber-600' :
                              'text-gray-900'
                            }`}>
                              {variant.quantityInStock}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Sold:</span>
                            <span className="ml-1 font-medium text-gray-900">{variant.soldQuantity || 0}</span>
                          </div>
                          {variant.sku && (
                            <div className="hidden xl:block">
                              <span className="text-gray-500">SKU:</span>
                              <span className="ml-1 font-mono text-xs text-gray-900">{variant.sku}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stock Status & Expand Icon */}
                      <div className="flex items-center space-x-2">
                        {variant.quantityInStock <= variant.reorderLevel && variant.quantityInStock > 0 && (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                        {expandedVariants[variant._id || `${color}-${variant.size}-${variantIndex}`] ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {expandedVariants[variant._id || `${color}-${variant.size}-${variantIndex}`] && (
                      <div className="px-4 pb-4 bg-gray-50/50">
                        <div className="grid grid-cols-2 gap-4 pt-3">
                          {/* Reorder Level */}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Reorder Level</p>
                            <p className="text-sm font-medium text-gray-900">{variant.reorderLevel || 5}</p>
                          </div>

                          {/* Barcode */}
                          {variant.barcode && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Barcode</p>
                              <p className="text-sm font-mono text-gray-900">{variant.barcode}</p>
                            </div>
                          )}

                          {/* Images Count */}
                          {variant.images && variant.images.length > 0 && (
                            <div className="col-span-2">
                              <p className="text-xs text-gray-500 mb-1">Images</p>
                              <div className="flex items-center space-x-1">
                                <ImageIcon className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {variant.images.length}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* SKU for mobile */}
                          {variant.sku && (
                            <div className="col-span-2 xl:hidden">
                              <p className="text-xs text-gray-500 mb-1">SKU</p>
                              <p className="text-sm font-mono text-gray-900">{variant.sku}</p>
                            </div>
                          )}
                        </div>

                        {/* Variant Images */}
                        {variant.images && variant.images.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-2">Variant Images</p>
                            <div className="flex flex-wrap gap-2">
                              {variant.images.slice(0, 4).map((imageUrl, idx) => (
                                <div 
                                  key={`${variant._id || `${color}-${variant.size}`}-img-${idx}`}
                                  className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
                                >
                                  <img
                                    src={imageUrl}
                                    alt={`${color} - ${variant.size}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                              {variant.images.length > 4 && (
                                <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                                  <span className="text-xs text-gray-500">
                                    +{variant.images.length - 4}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stock Warning */}
                        {variant.quantityInStock <= variant.reorderLevel && variant.isActive && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-amber-900">
                                  {variant.quantityInStock === 0 ? 'Out of Stock' : 'Low Stock Alert'}
                                </p>
                                <p className="text-xs text-amber-700 mt-1">
                                  {variant.quantityInStock === 0 
                                    ? 'This variant is currently out of stock'
                                    : `Stock level is at or below reorder point (${variant.reorderLevel})`
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockVariants.length > 0 && (
        <div className="p-6 bg-amber-50 border-t border-amber-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 mb-1">
                {lowStockVariants.length} variant{lowStockVariants.length !== 1 ? 's' : ''} need{lowStockVariants.length === 1 ? 's' : ''} restocking
              </p>
              <p className="text-xs text-amber-700">
                Review your stock levels and reorder as needed to avoid stockouts.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
