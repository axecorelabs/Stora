import { useState } from 'react';
import ProductCard from './ProductCard';

export default function ProductGrid({ products, customization, storeName, storeType }) {
  const [sortBy, setSortBy] = useState('name');

  if (!products || products.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Yet</h3>
          <p className="text-gray-600">
            {storeName} is setting up their inventory. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-6 sm:p-8 mb-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center justify-between">
          <div className="max-w-md mb-6 lg:mb-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Grab Up to 50% Off On Selected Products
            </h2>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
              Buy Now
            </button>
          </div>
          <div className="hidden lg:block">
            <div className="w-48 h-48 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center">
              <span className="text-4xl">🛍️</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option>Product Type</option>
            <option>Electronics</option>
            <option>Clothing</option>
            <option>Home</option>
          </select>
          
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option>Price Range</option>
            <option>Under ₦10,000</option>
            <option>₦10,000 - ₦50,000</option>
            <option>Above ₦50,000</option>
          </select>

          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option>Rating</option>
            <option>5 Stars</option>
            <option>4+ Stars</option>
            <option>3+ Stars</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="name">Name</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Rating</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Products Section */}
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Products For You!</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              customization={customization}
              storeType={storeType}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
