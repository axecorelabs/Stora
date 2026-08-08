"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { 
  Heart, 
  ArrowLeft, 
  ShoppingCart, 
  Trash2, 
  Package, 
  Tag,
  Eye
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import useStoreStore from "@/stores/storeStore";

export default function StoreWishlistPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { isAuthenticated, customer, isLoading: authLoading } = useAuth();
  const { addToCart } = useCart();
  
  // Get store from Zustand store
  const { currentStore, fetchStore } = useStoreStore();
  
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToCart, setAddingToCart] = useState(null);
  const [removingItem, setRemovingItem] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Screen size detection
  useEffect(() => {
    const detectScreenSize = () => {
      if (typeof window !== 'undefined') {
        return window.innerWidth < 768;
      }
      return false;
    };

    const handleResize = () => {
      setIsMobile(detectScreenSize());
    };

    setIsMobile(detectScreenSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch store if not loaded
  useEffect(() => {
    if (resolvedParams.slug && (!currentStore || currentStore.ivmaWebsite?.websitePath !== resolvedParams.slug)) {
      fetchStore(resolvedParams.slug);
    }
  }, [resolvedParams.slug, currentStore, fetchStore]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/${resolvedParams.slug}`);
    }
  }, [isAuthenticated, authLoading, router, resolvedParams.slug]);

  // Fetch wishlist
  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated]);

  // Store colors with fallbacks
  const primaryColor = currentStore?.branding?.primaryColor || '#0D9488';
  const secondaryColor = currentStore?.branding?.secondaryColor || '#F3F4F6';
  const currency = currentStore?.settings?.currency || 'NGN';

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/wishlist", {
        credentials: 'include'
      });
      const data = await response.json();

      if (response.ok && data.success) {
        // Filter items from this store only
        const storeItems = data.wishlist?.items?.filter(item => 
          item.storeSnapshot?.storeSlug === resolvedParams.slug ||
          item.storeSnapshot?.ivmaWebsite?.websitePath === resolvedParams.slug
        ) || [];
        
        setWishlist({
          ...data.wishlist,
          items: storeItems,
          itemCount: storeItems.length,
          totalWishlistValue: storeItems.reduce((sum, item) => sum + (item.productSnapshot?.sellingPrice || 0), 0)
        });
      } else {
        setError(data.message || "Failed to load wishlist");
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      setError("Failed to load wishlist");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (currency === 'NGN') {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
  };

  const handleAddToCart = async (item) => {
    if (!isAuthenticated) return;

    setAddingToCart(item._id);
    
    try {
      const result = await addToCart(item.product._id || item.product, 1);
      
      if (result.success) {
        alert("Item added to cart successfully!");
      } else {
        alert(result.error || "Failed to add item to cart");
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      alert("Failed to add item to cart");
    } finally {
      setAddingToCart(null);
    }
  };

  const handleRemoveFromWishlist = async (productId) => {
    if (!confirm("Remove this item from your wishlist?")) return;

    setRemovingItem(productId);
    
    try {
      const response = await fetch(`/api/wishlist/${productId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Filter items for this store
        const storeItems = data.wishlist?.items?.filter(item => 
          item.storeSnapshot?.storeSlug === resolvedParams.slug ||
          item.storeSnapshot?.ivmaWebsite?.websitePath === resolvedParams.slug
        ) || [];
        
        setWishlist({
          ...data.wishlist,
          items: storeItems,
          itemCount: storeItems.length,
          totalWishlistValue: storeItems.reduce((sum, item) => sum + (item.productSnapshot?.sellingPrice || 0), 0)
        });
      } else {
        alert(data.message || "Failed to remove item");
      }
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      alert("Failed to remove item");
    } finally {
      setRemovingItem(null);
    }
  };

  const handleViewProduct = (item) => {
    router.push(`/${resolvedParams.slug}/product/${item.product._id || item.product}`);
  };

  if (authLoading || loading || !currentStore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-4 mb-4 mx-auto"
            style={{ borderTopColor: primaryColor }}
          ></div>
          <p className="text-gray-600">Loading your wishlist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-4">💔</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Wishlist Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/${resolvedParams.slug}`)}
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Optimized */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push(`/${resolvedParams.slug}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium text-sm md:text-base">Back to {currentStore?.storeName || 'Store'}</span>
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Heart className="w-5 h-5 md:w-6 md:h-6" style={{ color: primaryColor }} />
              </div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-gray-900">My Wishlist</h1>
                <p className="text-xs md:text-sm text-gray-600">
                  {wishlist?.itemCount || 0} {wishlist?.itemCount === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>

            {!isMobile && currentStore?.branding?.logo && (
              <img 
                src={currentStore.branding.logo} 
                alt={currentStore.storeName} 
                className="h-8 w-auto object-contain opacity-60" 
              />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {!wishlist || wishlist.items?.length === 0 ? (
          // Empty Wishlist
          <div className="bg-white rounded-2xl border border-gray-100 p-8 md:p-12 text-center">
            <div className="text-6xl md:text-8xl mb-4 md:mb-6">💝</div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-3">
              No items from {currentStore?.storeName || 'this store'}
            </h3>
            <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8 max-w-md mx-auto">
              Browse {currentStore?.storeName || 'this store'} and add items you love to your wishlist.
            </p>
            <button
              onClick={() => router.push(`/${resolvedParams.slug}`)}
              className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 text-white rounded-xl text-sm md:text-base font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              <Package className="w-4 h-4 md:w-5 md:h-5" />
              Browse Store
            </button>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6">
            {/* Stats - Mobile Optimized */}
            <div 
              className="rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-6"
              style={{ backgroundColor: `${primaryColor}05` }}
            >
              <div className="grid grid-cols-3 gap-3 md:gap-6">
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-gray-900">{wishlist.itemCount}</div>
                  <div className="text-xs md:text-sm text-gray-600">Items</div>
                </div>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold" style={{ color: primaryColor }}>
                    {formatPrice(wishlist.totalWishlistValue)}
                  </div>
                  <div className="text-xs md:text-sm text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-green-600">
                    {wishlist.items?.filter(item => item.productSnapshot?.quantityInStock > 0).length || 0}
                  </div>
                  <div className="text-xs md:text-sm text-gray-600">In Stock</div>
                </div>
              </div>
            </div>

            {/* Items Grid - Matching ProductCard Style */}
            <div className={`grid ${
              isMobile 
                ? 'grid-cols-2 gap-3' 
                : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            }`}>
              {wishlist.items.map((item) => (
                <div
                  key={item._id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all"
                >
                  {/* Product Image */}
                  <div className={isMobile ? 'p-0' : 'p-4'}>
                    <div 
                      className={`relative w-full aspect-square ${isMobile ? 'rounded-none' : 'rounded-xl'} overflow-hidden mb-3`}
                      style={{ backgroundColor: secondaryColor }}
                    >
                      {item.productSnapshot?.image ? (
                        <img
                          src={item.productSnapshot.image}
                          alt={item.productSnapshot?.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl md:text-4xl">
                          📦
                        </div>
                      )}

                      {/* Stock Badge - Top Left */}
                      {item.productSnapshot?.quantityInStock <= 0 && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
                          Out of Stock
                        </div>
                      )}

                      {/* Wishlist Remove Button - Top Right */}
                      <button
                        onClick={() => handleRemoveFromWishlist(item.product._id || item.product)}
                        disabled={removingItem === (item.product._id || item.product)}
                        className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white hover:scale-110 transition-all disabled:opacity-50 z-10"
                      >
                        {removingItem === (item.product._id || item.product) ? (
                          <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-600" />
                        )}
                      </button>
                    </div>

                    {/* Product Details */}
                    <div className={isMobile ? 'px-3 pb-3' : ''}>
                      <div className="space-y-2">
                        <div>
                          <h3 className={`font-semibold text-gray-900 line-clamp-1 ${
                            isMobile ? 'text-base' : 'text-lg'
                          }`}>
                            {item.productSnapshot?.productName}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {item.productSnapshot?.category}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-gray-500" />
                          <span className={`font-bold ${isMobile ? 'text-sm' : 'text-base'}`} style={{ color: primaryColor }}>
                            {formatPrice(item.productSnapshot?.sellingPrice)}
                          </span>
                        </div>

                        {/* Stock Status - Only on Desktop */}
                        {!isMobile && item.productSnapshot?.quantityInStock > 0 && (
                          <span className="text-xs text-green-600 font-medium block">
                            {item.productSnapshot.quantityInStock} available
                          </span>
                        )}

                        {/* Priority Badge - Only on Desktop */}
                        {!isMobile && item.priority && item.priority !== 'medium' && (
                          <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                            item.priority === 'high' 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.priority} priority
                          </span>
                        )}

                        {/* Notes - Only on Desktop */}
                        {!isMobile && item.notes && (
                          <p className="text-xs text-gray-600 line-clamp-2 pt-1">
                            {item.notes}
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className={`flex gap-2 ${isMobile ? 'pt-1' : 'pt-2'}`}>
                          {isMobile ? (
                            // Mobile: Single compact button
                            <button
                              onClick={() => handleAddToCart(item)}
                              disabled={item.productSnapshot?.quantityInStock <= 0 || addingToCart === item._id}
                              className="flex-1 py-1.5 text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                              style={{ backgroundColor: item.productSnapshot?.quantityInStock <= 0 ? '#9CA3AF' : primaryColor }}
                            >
                              {addingToCart === item._id ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : item.productSnapshot?.quantityInStock <= 0 ? (
                                'Not Available'
                              ) : (
                                <>
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>Add to Cart</span>
                                </>
                              )}
                            </button>
                          ) : (
                            // Desktop: Two buttons
                            <>
                              <button
                                onClick={() => handleAddToCart(item)}
                                disabled={item.productSnapshot?.quantityInStock <= 0 || addingToCart === item._id}
                                className="flex-1 py-2 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                style={{ backgroundColor: primaryColor }}
                              >
                                {addingToCart === item._id ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <ShoppingCart className="w-4 h-4" />
                                    <span>Add to Cart</span>
                                  </>
                                )}
                              </button>
                              
                              <button
                                onClick={() => handleViewProduct(item)}
                                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
