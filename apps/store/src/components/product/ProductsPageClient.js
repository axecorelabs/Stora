"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, SlidersHorizontal, Grid2X2, List, Search, SearchX, Package, X, AlertTriangle } from "lucide-react";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import ProductCard from "@/components/store/ProductCard";
import ProductCardMobile from "@/components/store/ProductCardMobile";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import FloatingCartButton from "@/components/ui/FloatingCartButton";
import SignInModal from "@/components/auth/SignInModal";
import SignUpModal from "@/components/auth/SignUpModal";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";
import { useProducts } from "@/hooks/useProducts";

export default function ProductsPageClient({ store, products: initialProducts, slug }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Use TanStack Query, seeded with the SSR-fetched (already-enriched)
  // products so this doesn't immediately re-fetch the whole catalog again
  // on mount -- see useProducts.js.
  const { data: products = initialProducts, isLoading, error } = useProducts(store.id, initialProducts);
  
  const [isMobile, setIsMobile] = useState(false);
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  
  // Get category from URL params, default to 'all'
  const [selectedCategory, setSelectedCategory] = useState("all");

  const primaryColor = store.branding?.primaryColor || "#0D9488";
  const secondaryColor = store.branding?.secondaryColor || "#F3F4F6";

  // Initialize category/search from URL on mount -- search arrives here from
  // the header's search box (StoreHeader.js), which has no results view of
  // its own.
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [searchParams]);

  // Screen size detection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category))];
    return ['all', ...cats];
  }, [products]);

  // Filter and sort products - NOW INCLUDING SEARCH
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => 
        p.productName.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Sort products
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.sellingPrice - b.sellingPrice);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.sellingPrice - a.sellingPrice);
        break;
      case 'name-az':
        filtered.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case 'name-za':
        filtered.sort((a, b) => b.productName.localeCompare(a.productName));
        break;
      default:
        // Keep original order
        break;
    }

    return filtered;
  }, [products, searchQuery, selectedCategory, sortBy]);

  const formatPrice = (price) => {
    const currency = store.settings?.currency || 'NGN';
    return currency === 'NGN' ? `₦${price?.toLocaleString()}` : `$${price?.toLocaleString()}`;
  };

  // Update URL when category changes
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    
    // Update URL without page reload
    const newUrl = category === 'all' 
      ? `/${slug}/products`
      : `/${slug}/products?category=${encodeURIComponent(category)}`;
    
    router.push(newUrl, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <StoreHeader store={store} />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setIsNavigating(true);
                  router.push(`/${slug}`);
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back</span>
              </button>
              <span className="text-gray-300">›</span>
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-gray-900">All products</h1>
            </div>

            {/* View Mode Toggle - Desktop Only */}
            {!isMobile && (
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white shadow-sm'
                      : 'hover:bg-gray-200'
                  }`}
                  style={{
                    color: viewMode === 'grid' ? primaryColor : '#6B7280'
                  }}
                >
                  <Grid2X2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white shadow-sm'
                      : 'hover:bg-gray-200'
                  }`}
                  style={{
                    color: viewMode === 'list' ? primaryColor : '#6B7280'
                  }}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands, categories…"
              className="w-full pl-10 pr-10 py-3 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all text-sm sm:text-base bg-gray-50/70 focus:bg-white"
              style={{ '--tw-ring-color': primaryColor }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Search Results Info */}
          {searchQuery && (
            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-sm text-gray-500">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'} for &ldquo;{searchQuery}&rdquo;
              </p>
              {filteredProducts.length > 0 && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-medium hover:underline"
                  style={{ color: primaryColor }}
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full sm:w-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  backgroundColor: selectedCategory === category ? primaryColor : secondaryColor,
                  color: selectedCategory === category ? 'white' : '#374151'
                }}
              >
                {category === 'all' ? 'All' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold" style={{ color: primaryColor }}>
              {filteredProducts.length}
            </span> {filteredProducts.length === 1 ? 'product' : 'products'}
            {selectedCategory !== 'all' && ` in ${selectedCategory}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>

        {/* Products Grid/List */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-[3px] border-brand-100 border-t-brand-700 mb-4"></div>
            <p className="text-brand-800/60 text-sm">Loading products…</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-500" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-lg font-semibold text-gray-900 mb-1.5">Couldn&apos;t load products</h3>
            <p className="text-sm text-gray-500 mb-5">{error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 text-white rounded-xl text-sm font-medium bg-brand-700 hover:bg-brand-800 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
              {searchQuery ? (
                <SearchX className="w-7 h-7 text-brand-600" strokeWidth={1.5} />
              ) : (
                <Package className="w-7 h-7 text-brand-600" strokeWidth={1.5} />
              )}
            </div>
            <h3 className="font-display text-lg font-semibold text-gray-900 mb-1.5">
              {searchQuery ? 'No results found' : 'No products found'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {searchQuery
                ? `Nothing matched "${searchQuery}" — try a different search.`
                : 'Try selecting a different category.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-6 py-2.5 text-white rounded-xl text-sm font-medium bg-brand-700 hover:bg-brand-800 transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div 
            className={
              isMobile 
                ? 'grid grid-cols-2 gap-3'
                : viewMode === 'grid'
                ? 'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
            }
          >
            {filteredProducts.map((product) => (
              isMobile ? (
                <ProductCardMobile
                  key={product.id}
                  product={product}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  currency={store.settings?.currency || "NGN"}
                  onNavigate={() => setIsNavigating(true)}
                />
              ) : viewMode === 'grid' ? (
                <ProductCard
                  key={product.id}
                  product={product}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  currency={store.settings?.currency || "NGN"}
                  onNavigate={() => setIsNavigating(true)}
                />
              ) : (
                // List View (Desktop)
                <div
                  key={product.id}
                  className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    setIsNavigating(true);
                    router.push(`/${slug}/product/${product.id}`);
                  }}
                >
                  <div className="flex gap-6">
                    {/* Product Image */}
                    <div 
                      className="w-48 h-48 rounded-xl overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: secondaryColor }}
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-gray-300" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {product.productName}
                      </h3>
                      <p className="text-sm text-gray-500 mb-3">
                        {product.category}
                      </p>
                      {product.description && (
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                          {formatPrice(product.sellingPrice)}
                        </span>
                        <span className={`text-sm font-medium ${
                          product.quantityInStock > product.reorderLevel
                            ? 'text-green-600'
                            : product.quantityInStock > 0
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {product.quantityInStock > product.reorderLevel
                            ? 'In Stock'
                            : product.quantityInStock > 0
                            ? 'Low Stock'
                            : 'Out of Stock'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      <StoreFooter />

      {/* Loading Overlay for Navigation */}
      <LoadingOverlay 
        isVisible={isNavigating || isLoading} 
        color={primaryColor}
        message={isNavigating ? "Loading product..." : "Loading products..."}
      />

      {/* Floating Cart Button */}
      <FloatingCartButton 
        onNavigate={() => setIsNavigating(true)}
        onSignInRequired={() => setShowSignInModal(true)}
      />

      {/* Auth Modals */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        onSwitchToSignUp={() => {
          setShowSignInModal(false);
          setShowSignUpModal(true);
        }}
        onForgotPassword={() => {
          setShowSignInModal(false);
          setShowForgotPasswordModal(true);
        }}
      />

      <SignUpModal
        isOpen={showSignUpModal}
        onClose={() => setShowSignUpModal(false)}
        onSwitchToSignIn={() => {
          setShowSignUpModal(false);
          setShowSignInModal(true);
        }}
      />

      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        onBackToSignIn={() => {
          setShowForgotPasswordModal(false);
          setShowSignInModal(true);
        }}
      />

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
