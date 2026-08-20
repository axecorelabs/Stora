"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Heart, ArrowLeft, ShoppingCart, Trash2, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

// Cross-vendor wishlist -- everything the customer has saved, across every
// store, grouped by vendor. Distinct from /[slug]/wishlist (deliberately
// scoped to just the current store's items); this page has no "current
// store" to scope to, by design, since it's reachable from entry points
// with no vendor slug in context (e.g. the homepage header).
export default function WishlistPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToCart } = useCart();

  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToCart, setAddingToCart] = useState(null);
  const [removingItem, setRemovingItem] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/wishlist", { credentials: "include" });
        const data = await response.json();
        if (cancelled) return;
        if (response.ok && data.success) {
          setWishlist(data.wishlist);
        } else {
          setError(data.message || "Failed to load wishlist");
        }
      } catch (err) {
        console.error("Error fetching wishlist:", err);
        if (!cancelled) setError("Failed to load wishlist");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const formatPrice = (price) => `₦${Number(price || 0).toLocaleString("en-NG")}`;

  const handleAddToCart = async (item) => {
    setAddingToCart(item.id);
    try {
      const result = await addToCart(item.product_id, 1);
      if (!result.success) {
        console.error("Failed to add item to cart:", result.error);
      }
    } catch (err) {
      console.error("Error adding to cart:", err);
    } finally {
      setAddingToCart(null);
    }
  };

  const handleRemove = async (item) => {
    setRemovingItem(item.id);
    try {
      const response = await fetch(`/api/wishlist/${item.product_id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setWishlist(data.wishlist);
      }
    } catch (err) {
      console.error("Error removing from wishlist:", err);
    } finally {
      setRemovingItem(null);
    }
  };

  const handleView = (item) => {
    if (item.store_data?.store_slug) {
      // ?from=discover -- this page has no "current store" (see the
      // file-level comment), so a product opened from here should send the
      // visitor back to general browsing, not strand them on that vendor's
      // storefront.
      router.push(`/${item.store_data.store_slug}/product/${item.product_id}?from=discover`);
    }
  };

  const groups = useMemo(() => {
    const byStore = new Map();
    for (const item of wishlist?.items || []) {
      const key = item.store_id || "unknown";
      if (!byStore.has(key)) {
        byStore.set(key, { storeName: item.store_data?.store_name || "Store", items: [] });
      }
      byStore.get(key).items.push(item);
    }
    return [...byStore.values()];
  }, [wishlist]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-brand-50/40 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-brand-100 border-t-brand-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-50/40 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="font-display text-xl font-bold text-brand-900 mb-2">Couldn&apos;t load your wishlist</h1>
          <p className="text-sm text-brand-800/60 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go home
          </button>
        </div>
      </div>
    );
  }

  const itemCount = wishlist?.items?.length || 0;

  return (
    <div className="min-h-screen bg-brand-50/40">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-brand-800/60 hover:text-brand-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Home</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
              <Heart className="w-5 h-5 text-brand-700" strokeWidth={2} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-brand-900">Your wishlist</h1>
              <p className="text-xs text-brand-800/50">
                {itemCount} {itemCount === 1 ? "item" : "items"} · {groups.length} {groups.length === 1 ? "vendor" : "vendors"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {itemCount === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-5">
              <Heart className="w-7 h-7 text-brand-700" strokeWidth={1.5} />
            </div>
            <h2 className="font-display text-lg font-bold text-brand-900 mb-2">Nothing saved yet</h2>
            <p className="text-sm text-brand-800/60 mb-6 max-w-xs mx-auto">
              Items you save while browsing will show up here.
            </p>
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors"
            >
              Start shopping
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group, idx) => (
              <div key={idx}>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">
                  {group.storeName}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-gray-100 overflow-hidden group"
                    >
                      <div className="p-3">
                        <div
                          className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer"
                          onClick={() => handleView(item)}
                        >
                          {item.product_data?.primary_image ? (
                            <img
                              src={item.product_data.primary_image}
                              alt={item.product_data?.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                            </div>
                          )}
                          {!item.in_stock && (
                            <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                              Out of stock
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(item);
                            }}
                            disabled={removingItem === item.id}
                            className="absolute top-2 right-2 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                          >
                            {removingItem === item.id ? (
                              <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="px-3.5 pb-3.5">
                        <h3 className="text-[13px] font-semibold text-brand-900 line-clamp-1 mb-1">
                          {item.product_data?.name}
                        </h3>
                        <p className="text-sm font-bold text-brand-800 mb-2 tabular-nums">
                          {formatPrice(item.product_data?.base_price)}
                        </p>
                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={!item.in_stock || addingToCart === item.id}
                          className="w-full py-2 bg-brand-700 text-white rounded-lg text-xs font-medium hover:bg-brand-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          {addingToCart === item.id ? (
                            <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : !item.in_stock ? (
                            "Out of stock"
                          ) : (
                            <>
                              <ShoppingCart className="w-3 h-3" />
                              Add to cart
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
