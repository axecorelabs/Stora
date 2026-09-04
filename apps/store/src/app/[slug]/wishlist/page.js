"use client";
import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  ArrowLeft,
  ShoppingCart,
  Trash2,
  Package,
  Eye,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import useStoreStore from "@/stores/storeStore";
import Toast from "@/components/ui/Toast";
import { storeHref } from "@/lib/storeUrl";

export default function StoreWishlistPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { isAuthenticated, customer, isLoading: authLoading } = useAuth();
  const { addToCart } = useCart();

  // Get store from Zustand store
  const { currentStore, fetchStore } = useStoreStore();

  // Raw wishlist response (every store's items) -- filtered down to this
  // store's items via useMemo below, kept separate from the fetch so the
  // filter re-runs once currentStore finishes loading instead of racing it.
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToCart, setAddingToCart] = useState(null);
  const [removingItem, setRemovingItem] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState(null);

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
    if (resolvedParams.slug && (!currentStore || currentStore.storeSlug !== resolvedParams.slug)) {
      fetchStore(resolvedParams.slug);
    }
  }, [resolvedParams.slug, currentStore, fetchStore]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(storeHref(resolvedParams.slug));
    }
  }, [isAuthenticated, authLoading, router, resolvedParams.slug]);

  // Store colors with fallbacks
  const primaryColor = currentStore?.branding?.primaryColor || '#0D9488';
  const secondaryColor = currentStore?.branding?.secondaryColor || '#F3F4F6';

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

  // Fetch wishlist -- unfiltered; store-scoping happens in storeItems below,
  // once currentStore is actually available.
  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated]);

  // Items scoped to this store, matched on the real store_id rather than
  // parsing store_snapshot -- that snapshot is frozen at the moment an item
  // was wishlisted (sometimes months ago) and its field names/casing have
  // drifted across the IVMA->Stora rebrand since, so matching against it
  // silently matched nothing for every store, ever. store_id is a real,
  // stable foreign key and isn't affected by any of that.
  const storeItems = useMemo(() => {
    if (!wishlist?.items || !currentStore?.id) return [];
    return wishlist.items.filter(item => item.store_id === currentStore.id);
  }, [wishlist, currentStore]);

  const totalWishlistValue = useMemo(
    () => storeItems.reduce((sum, item) => sum + (item.product_data?.base_price || 0), 0),
    [storeItems]
  );
  const inStockCount = useMemo(
    () => storeItems.filter(item => item.in_stock).length,
    [storeItems]
  );

  const formatPrice = (price) => `₦${price?.toLocaleString()}`;

  const handleAddToCart = async (item) => {
    if (!isAuthenticated) return;

    setAddingToCart(item.id);

    try {
      const result = await addToCart(item.product_id, 1);

      if (result.success) {
        setToast({ message: "Added to cart", type: 'success' });
      } else {
        setToast({ message: result.error || "Failed to add item to cart", type: 'error' });
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      setToast({ message: "Failed to add item to cart", type: 'error' });
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
        setToast({ message: data.message || "Failed to remove item", type: 'error' });
      }
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      setToast({ message: "Failed to remove item", type: 'error' });
    } finally {
      setRemovingItem(null);
    }
  };

  const handleViewProduct = (item) => {
    router.push(storeHref(resolvedParams.slug, `/product/${item.product_id}`));
  };

  if (authLoading || loading || !currentStore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50/40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-brand-100 border-t-brand-700 mb-4 mx-auto"></div>
          <p className="text-brand-800/60 text-sm">Loading your wishlist…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50/40 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500" strokeWidth={1.5} />
          </div>
          <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">Couldn&apos;t load your wishlist</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => router.push(storeHref(resolvedParams.slug))}
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl text-sm font-semibold bg-brand-700 hover:bg-brand-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to store
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
            onClick={() => router.push(storeHref(resolvedParams.slug))}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium text-sm">Back to {currentStore?.storeName || 'Store'}</span>
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-50">
                <Heart className="w-5 h-5 text-brand-700" />
              </div>
              <div>
                <h1 className="font-display text-xl md:text-2xl font-semibold text-gray-900">My wishlist</h1>
                <p className="text-xs md:text-sm text-gray-500 tabular-nums">
                  {storeItems.length} {storeItems.length === 1 ? 'item' : 'items'}
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
        {storeItems.length === 0 ? (
          // Empty Wishlist
          <div className="bg-white rounded-2xl border border-gray-100 p-10 md:p-14 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand-50 flex items-center justify-center">
              <Heart className="w-7 h-7 text-brand-600" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-xl md:text-2xl font-semibold text-gray-900 mb-2">
              No items from {currentStore?.storeName || 'this store'} yet
            </h3>
            <p className="text-sm text-gray-500 mb-7 max-w-sm mx-auto">
              Browse {currentStore?.storeName || 'this store'} and save items you love here.
            </p>
            <button
              onClick={() => router.push(storeHref(resolvedParams.slug))}
              className="inline-flex items-center gap-2 px-7 py-3.5 text-white rounded-xl text-sm font-semibold hover:brightness-95 transition-all"
              style={{ backgroundColor: primaryColor }}
            >
              <Package className="w-4 h-4" />
              Browse store
            </button>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6">
            {/* Stats - Mobile Optimized */}
            <div className="rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-6 bg-white">
              <div className="grid grid-cols-3 gap-3 md:gap-6">
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-gray-900 tabular-nums">{storeItems.length}</div>
                  <div className="text-xs md:text-sm text-gray-500">Items</div>
                </div>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold tabular-nums" style={{ color: primaryColor }}>
                    {formatPrice(totalWishlistValue)}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-brand-700 tabular-nums">
                    {inStockCount}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500">In stock</div>
                </div>
              </div>
            </div>

            {/* Items Grid - Matching ProductCard Style */}
            <div className={`grid ${
              isMobile
                ? 'grid-cols-2 gap-3'
                : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            }`}>
              {storeItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] transition-shadow"
                >
                  {/* Product Image */}
                  <div className={isMobile ? 'p-0' : 'p-4'}>
                    <div
                      className={`relative w-full aspect-square ${isMobile ? 'rounded-none' : 'rounded-xl'} overflow-hidden mb-3`}
                      style={{ backgroundColor: secondaryColor }}
                    >
                      {item.product_data?.primary_image ? (
                        <img
                          src={item.product_data.primary_image}
                          alt={item.product_data?.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-9 h-9 text-gray-300" strokeWidth={1.5} />
                        </div>
                      )}

                      {/* Stock Badge - Top Left */}
                      {!item.in_stock && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                          {item.is_available === false ? 'No longer available' : 'Out of stock'}
                        </div>
                      )}

                      {/* Wishlist Remove Button - Top Right */}
                      <button
                        onClick={() => handleRemoveFromWishlist(item.product_id)}
                        disabled={removingItem === item.product_id}
                        className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-all disabled:opacity-50 z-10"
                      >
                        {removingItem === item.product_id ? (
                          <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-600" />
                        )}
                      </button>
                    </div>

                    {/* Product Details */}
                    <div className={isMobile ? 'px-3 pb-3' : ''}>
                      <div className="space-y-1.5">
                        <div>
                          <p className="text-[11px] text-gray-400 uppercase tracking-wide truncate">
                            {item.product_data?.category}
                          </p>
                          <h3 className={`font-semibold text-gray-900 line-clamp-1 ${
                            isMobile ? 'text-sm' : 'text-[15px]'
                          }`}>
                            {item.product_data?.name}
                          </h3>
                        </div>

                        {/* Price */}
                        <p className={`font-bold tabular-nums ${isMobile ? 'text-sm' : 'text-base'}`} style={{ color: primaryColor }}>
                          {formatPrice(item.product_data?.base_price)}
                        </p>

                        {/* Stock Status - Only on Desktop */}
                        {!isMobile && item.in_stock && (
                          <span className="text-xs text-brand-700 font-medium block">
                            {item.product_data?.stock_quantity} available
                          </span>
                        )}

                        {/* Priority Badge - Only on Desktop */}
                        {!isMobile && item.priority && item.priority !== 'medium' && (
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                            item.priority === 'high'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.priority} priority
                          </span>
                        )}

                        {/* Notes - Only on Desktop */}
                        {!isMobile && item.notes && (
                          <p className="text-xs text-gray-500 line-clamp-2 pt-1">
                            {item.notes}
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className={`flex gap-2 ${isMobile ? 'pt-1' : 'pt-2'}`}>
                          {isMobile ? (
                            // Mobile: Single compact button
                            <button
                              onClick={() => handleAddToCart(item)}
                              disabled={!item.in_stock || addingToCart === item.id}
                              className="flex-1 py-1.5 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                              style={{ backgroundColor: !item.in_stock ? '#9CA3AF' : primaryColor }}
                            >
                              {addingToCart === item.id ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : !item.in_stock ? (
                                'Not available'
                              ) : (
                                <>
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>Add to cart</span>
                                </>
                              )}
                            </button>
                          ) : (
                            // Desktop: Two buttons
                            <>
                              <button
                                onClick={() => handleAddToCart(item)}
                                disabled={!item.in_stock || addingToCart === item.id}
                                className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                style={{ backgroundColor: !item.in_stock ? '#9CA3AF' : primaryColor }}
                              >
                                {addingToCart === item.id ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : !item.in_stock ? (
                                  'Not available'
                                ) : (
                                  <>
                                    <ShoppingCart className="w-4 h-4" />
                                    <span>Add to cart</span>
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

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
