"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Heart, 
  ArrowLeft, 
  ShoppingCart, 
  Trash2, 
  Package, 
  Tag,
  Eye,
  Share2,
  Settings,
  Star,
  Filter
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

export default function WishlistPage() {
  const router = useRouter();
  const { isAuthenticated, customer, isLoading: authLoading } = useAuth();
  const { addToCart } = useCart();
  
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToCart, setAddingToCart] = useState(null);
  const [removingItem, setRemovingItem] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [showStoreFilter, setShowStoreFilter] = useState(false);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch wishlist
  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated]);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/wishlist", {
        credentials: 'include'
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setWishlist(data.wishlist);
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

  const formatPrice = (price, currency = 'NGN') => {
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
        // Show success message or toast
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
        setWishlist(data.wishlist);
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
    const storeSlug = item.storeSnapshot?.storeSlug || item.storeSnapshot?.ivmaWebsite?.websitePath;
    if (storeSlug) {
      router.push(`/${storeSlug}/product/${item.product._id || item.product}`);
    } else {
      // Fallback to product details if no store slug
      alert("Product page not available");
    }
  };

  // Filter items based on priority
  const filteredItems = wishlist?.items?.filter(item => {
    if (filterPriority === 'all') return true;
    return item.priority === filterPriority;
  }) || [];

  // Get unique stores
  const stores = [...new Set(wishlist?.items?.map(item => item.storeSnapshot?.storeName).filter(Boolean))] || [];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-red-50 to-rose-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-200 border-t-red-600 mb-4 mx-auto"></div>
          <p className="text-gray-600">Loading your wishlist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-red-50 to-rose-50">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-4">💔</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Wishlist Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-red-50 to-rose-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-red-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Heart className="w-8 h-8 text-white fill-current" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{wishlist?.itemCount || 0}</span>
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                  My Wishlist
                </h1>
                <p className="text-gray-600 text-lg">
                  {wishlist?.itemCount || 0} {wishlist?.itemCount === 1 ? 'item' : 'items'} • {stores.length} {stores.length === 1 ? 'store' : 'stores'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowStoreFilter(!showStoreFilter)}
                className="flex items-center gap-2 px-4 py-2 bg-white/70 border border-red-200 rounded-xl text-gray-700 hover:bg-white transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/70 border border-red-200 rounded-xl text-gray-700 hover:bg-white transition-colors">
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/70 border border-red-200 rounded-xl text-gray-700 hover:bg-white transition-colors">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {!wishlist || wishlist.items?.length === 0 ? (
          // Empty Wishlist
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl border border-red-100 p-16 text-center">
            <div className="w-32 h-32 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <Heart className="w-16 h-16 text-red-400" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Your Heart is Empty</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
              Start browsing and save items you love. They'll appear here for easy access later.
            </p>
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-semibold hover:from-red-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg"
            >
              <Package className="w-5 h-5" />
              Start Shopping
            </button>
          </div>
        ) : (
          // Wishlist Items
          <div className="space-y-8">
            {/* Stats and Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Stats Cards */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-red-100 p-6 text-center">
                <div className="text-3xl font-bold text-gray-900">{wishlist.itemCount}</div>
                <div className="text-sm text-gray-600">Total Items</div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-red-100 p-6 text-center">
                <div className="text-3xl font-bold text-red-600">
                  {formatPrice(wishlist.totalWishlistValue)}
                </div>
                <div className="text-sm text-gray-600">Total Value</div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-red-100 p-6 text-center">
                <div className="text-3xl font-bold text-gray-900">{stores.length}</div>
                <div className="text-sm text-gray-600">{stores.length === 1 ? 'Store' : 'Stores'}</div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-red-100 p-6 text-center">
                <div className="text-3xl font-bold text-green-600">{wishlist.inStockItems?.length || 0}</div>
                <div className="text-sm text-gray-600">In Stock</div>
              </div>
            </div>

            {/* Priority Filter */}
            <div className="flex flex-wrap gap-3">
              {['all', 'high', 'medium', 'low'].map((priority) => (
                <button
                  key={priority}
                  onClick={() => setFilterPriority(priority)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    filterPriority === priority
                      ? 'bg-red-600 text-white shadow-lg'
                      : 'bg-white/60 text-gray-700 hover:bg-white'
                  }`}
                >
                  {priority === 'all' ? 'All Items' : `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`}
                </button>
              ))}
            </div>

            {/* Items Grid - Smaller Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item._id}
                  className="bg-white/60 backdrop-blur-sm rounded-2xl border border-red-100 overflow-hidden hover:shadow-xl hover:scale-105 transition-all duration-300 group"
                >
                  {/* Store Badge */}
                  <div className="px-3 py-2 bg-gradient-to-r from-red-500/10 to-pink-500/10 border-b border-red-100">
                    <p className="text-xs font-medium text-gray-600 truncate">
                      {item.storeSnapshot?.storeName || 'Store'}
                    </p>
                  </div>

                  {/* Product Image */}
                  <div className="p-3">
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100 mb-3">
                      {item.productSnapshot?.image ? (
                        <img
                          src={item.productSnapshot.image}
                          alt={item.productSnapshot?.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          📦
                        </div>
                      )}

                      {/* Stock Status */}
                      {item.productSnapshot?.quantityInStock <= 0 && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                          Out
                        </div>
                      )}

                      {/* Priority Badge */}
                      {item.priority && item.priority !== 'medium' && (
                        <div className={`absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-full ${
                          item.priority === 'high' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-blue-600 text-white'
                        }`}>
                          {item.priority === 'high' ? '🔥' : '⭐'}
                        </div>
                      )}

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveFromWishlist(item.product._id || item.product)}
                        disabled={removingItem === (item.product._id || item.product)}
                        className="absolute top-2 right-2 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                      >
                        {removingItem === (item.product._id || item.product) ? (
                          <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 text-red-600" />
                        )}
                      </button>
                    </div>

                    {/* Product Details */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-1 text-sm">
                        {item.productSnapshot?.productName}
                      </h3>
                      
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-600 text-sm">
                          {formatPrice(item.productSnapshot?.sellingPrice, item.storeSnapshot?.settings?.currency)}
                        </span>
                        {item.productSnapshot?.quantityInStock > 0 && (
                          <span className="text-xs text-green-600 font-medium">
                            {item.productSnapshot.quantityInStock} left
                          </span>
                        )}
                      </div>

                      {/* Notes */}
                      {item.notes && (
                        <p className="text-xs text-gray-600 line-clamp-1">
                          {item.notes}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={item.productSnapshot?.quantityInStock <= 0 || addingToCart === item._id}
                          className="flex-1 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg text-xs font-medium hover:from-red-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          {addingToCart === item._id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <ShoppingCart className="w-3 h-3" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleViewProduct(item)}
                          className="px-3 py-2 border border-red-200 rounded-lg text-gray-700 hover:bg-red-50 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* No items in filter */}
            {filteredItems.length === 0 && wishlist.items?.length > 0 && (
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-red-100 p-12 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  No items found
                </h3>
                <p className="text-gray-600">
                  Try adjusting your filter to see more items.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
