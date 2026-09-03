"use client";
import { useState } from "react";
import { ShoppingBag, ShoppingCart, Loader2, Check, Flame, Clock, Heart } from "lucide-react";
import { normalizeExtraDefinitions } from "@stora/shared-constants";
import PrefetchLink from "@/components/ui/PrefetchLink";
import QuickAddModal from "@/components/product/QuickAddModal";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsInWishlist, useWishlistMutations } from "@/hooks/useWishlist";
import useStoreStore from "@/stores/storeStore";
import { useRequireBiteraveAuth } from "./BiteraveAuthGateProvider";

// Shared by the pooled cross-restaurant grid (/biterave) and a single
// restaurant's own menu (/biterave/[storeSlug]) -- storeSlug/storeName are
// passed in explicitly by the caller rather than read off product.store
// directly, since the two call sites get that info from different shapes
// (searchProductsPaginated attaches a nested `store` per product;
// searchStoreProducts doesn't, since the page already knows the one store).
//
// Links are built as plain `/${storeSlug}/...` paths, NOT storeHref() --
// storeHref assumes "on a non-apex host = already on this exact vendor's
// own subdomain," which is wrong on biterave.stora.com.ng (a shared host,
// never any one vendor's own subdomain). See proxy.js's resolveBiteraveRewrite.
//
// Add-to-cart mirrors components/store/ProductCard.js's own gate exactly:
// variants -> product page (unchanged), priced extras -> QuickAddModal,
// else -> instant add. Signed-out customers get the shared sign-in modal
// (BiteraveAuthGateProvider, mounted once per page) instead of a silent
// failure -- same "open the modal and stop" shape ProductCard.js uses, no
// auto-retry of the add after a successful sign-in.
export default function FoodItemCard({ product, storeSlug, storeName }) {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const requireAuth = useRequireBiteraveAuth();
  const setCurrentStore = useStoreStore((s) => s.setStore);
  const liked = useIsInWishlist(product.id);
  const { addToWishlist, removeFromWishlist } = useWishlistMutations();
  const isUpdatingWishlist = addToWishlist.isPending || removeFromWishlist.isPending;
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const food = product.categoryDetails?.food || {};
  const extrasDefinitions = normalizeExtraDefinitions(food.extras);
  const productHref = `/${storeSlug}/product/${product.id}`;

  // Same optimistic pattern as components/home/DiscoveryProductCard.js.
  const handleWishlistToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (liked) {
        await removeFromWishlist.mutateAsync(product.id);
      } else {
        await addToWishlist.mutateAsync({ productId: product.id, priority: "medium", notes: "" });
      }
    } catch (err) {
      console.error("Error updating wishlist:", err);
    }
  };

  const handleAdd = async () => {
    if (!isAuthenticated) {
      requireAuth();
      return;
    }

    if (extrasDefinitions.length > 0) {
      // QuickAddModal's own "customize on the product page" sub-link
      // builds its URL via storeHref() off this same global store --
      // never populated by a cross-vendor Biterave listing, only by a
      // real vendor page. A minimal { storeSlug } is all storeHref()
      // actually reads, so this is enough to keep that sub-link correct
      // here too, not just on /biterave/[storeSlug].
      setCurrentStore({ storeSlug });
      setShowQuickAdd(true);
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const result = await addToCart(product.id, 1);
      if (result.success) {
        setAdded(true);
      } else {
        setError(result.error || "Failed to add to cart");
      }
    } catch (err) {
      console.error("Error adding food item to cart:", err);
      setError("Failed to add to cart");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] transition-shadow duration-200">
      <PrefetchLink href={productHref} className="relative block aspect-square bg-gray-50 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.productName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No image</div>
        )}

        {isAuthenticated && (
          <button
            onClick={handleWishlistToggle}
            disabled={isUpdatingWishlist}
            className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-all duration-200 disabled:opacity-50 z-10"
            aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              className={`w-4 h-4 transition-all duration-200 ${liked ? "scale-110" : ""}`}
              style={liked ? { color: "#145C41" } : { color: "#6B7280" }}
              strokeWidth={liked ? 0 : 2}
              fill={liked ? "#145C41" : "none"}
            />
          </button>
        )}
      </PrefetchLink>

      <div className="p-4 flex flex-col flex-1">
        {storeName && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-600 mb-1 truncate">{storeName}</p>
        )}
        <PrefetchLink href={productHref} className="text-sm font-semibold text-gray-900 truncate hover:text-brand-700">
          {product.productName}
        </PrefetchLink>
        <p className="text-sm text-gray-500 mt-0.5">
          ₦{Number(product.sellingPrice || 0).toLocaleString("en-NG")}
        </p>

        {(food.spiceLevel && food.spiceLevel !== "Not Spicy") || food.deliveryTime?.value ? (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            {food.spiceLevel && food.spiceLevel !== "Not Spicy" && (
              <span className="inline-flex items-center gap-0.5 text-orange-500">
                <Flame className="w-3.5 h-3.5" /> {food.spiceLevel}
              </span>
            )}
            {food.deliveryTime?.value && (
              <span className="inline-flex items-center gap-0.5">
                <Clock className="w-3.5 h-3.5" /> {food.deliveryTime.value} {food.deliveryTime.unit === "hours" ? "hr" : "min"}
              </span>
            )}
          </div>
        ) : null}

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        <div className="mt-3">
          {!product.hasVariants ? (
            <button
              onClick={handleAdd}
              disabled={adding || added}
              className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-70 ${
                added ? "bg-green-50 text-green-700" : "bg-brand-800 text-white hover:bg-brand-900"
              }`}
            >
              {adding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : added ? (
                <Check className="w-3.5 h-3.5" />
              ) : extrasDefinitions.length > 0 ? (
                <ShoppingCart className="w-3.5 h-3.5" />
              ) : (
                <ShoppingBag className="w-3.5 h-3.5" />
              )}
              {added ? "Added" : extrasDefinitions.length > 0 ? "Customize" : "Add to cart"}
            </button>
          ) : (
            <PrefetchLink
              href={productHref}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-brand-50 text-brand-800 hover:bg-brand-100 transition-colors"
            >
              Choose options
            </PrefetchLink>
          )}
        </div>
      </div>

      <QuickAddModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        product={product}
        onAddToCart={addToCart}
        primaryColor="#145C41"
      />
    </div>
  );
}
