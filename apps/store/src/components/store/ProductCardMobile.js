'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Heart, ShoppingCart, Check, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useIsInWishlist, useWishlistMutations } from '@/hooks/useWishlist';

export default function ProductCardMobile({ product, primaryColor, currency, secondaryColor, onNavigate, onSignInRequired }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Use TanStack Query hooks
  const liked = useIsInWishlist(product.id);
  const { addToWishlist, removeFromWishlist } = useWishlistMutations();

  const formatPrice = (price) => {
    if (currency === 'NGN') {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
  };

  const handleProductClick = () => {
    if (onNavigate) onNavigate();
    const storeSlug = pathname.split('/')[1];
    router.push(`/${storeSlug}/product/${product.id}`);
  };

  const handleWishlistToggle = async (e) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      onSignInRequired?.();
      return;
    }

    try {
      if (liked) {
        await removeFromWishlist.mutateAsync(product.id);
      } else {
        await addToWishlist.mutateAsync({
          productId: product.id,
          priority: 'medium',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error updating wishlist:', error);
    }
  };

  // Adds directly for a simple (no-variant) product; a variant product
  // still needs the size/color picker, which only lives on the product
  // detail page, so this sends those there instead of pretending it worked.
  const handleAddToCart = async (e) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      onSignInRequired?.();
      return;
    }

    if (product.hasVariants) {
      handleProductClick();
      return;
    }

    setIsAddingToCart(true);
    try {
      const result = await addToCart(product.id, 1);
      if (result.success) {
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1500);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const isUpdating = addToWishlist.isPending || removeFromWishlist.isPending;
  const isLowStock = product.availableQuantity > 0 && product.availableQuantity <= (product.reorderLevel || 5);
  const isOutOfStock = product.availableQuantity <= 0;

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] transition-all duration-200 group cursor-pointer active:scale-[0.98]"
      onClick={handleProductClick}
    >
      {/* Image Container */}
      <div className="relative">
        <div
          className="relative w-full aspect-square overflow-hidden"
          style={{ backgroundColor: secondaryColor || '#F3F4F6' }}
        >
          {product.image ? (
            <>
              {/* Loading skeleton */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shimmer-animation"
                  />
                </div>
              )}

              {/* Product Image with zoom effect */}
              <img
                src={product.image}
                alt={product.productName}
                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Package className="w-9 h-9 text-gray-300" strokeWidth={1.5} />
            </div>
          )}

          {/* Stock Badges */}
          {isOutOfStock && (
            <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Sold out
            </div>
          )}
          {isLowStock && !isOutOfStock && (
            <div className="absolute top-2 left-2 bg-gold-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Low stock
            </div>
          )}

          {/* Wishlist Button */}
          {isAuthenticated && (
            <button
              onClick={handleWishlistToggle}
              disabled={isUpdating}
              className="absolute top-2 right-2 w-8 h-8 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all shadow-sm disabled:opacity-50 z-10"
            >
              {isUpdating ? (
                <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Heart
                  className={`w-4 h-4 transition-all duration-200 ${liked ? 'scale-110' : ''}`}
                  style={liked ? { color: primaryColor } : { color: '#9CA3AF' }}
                  strokeWidth={liked ? 0 : 2.5}
                  fill={liked ? primaryColor : 'none'}
                />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-1">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide truncate">
          {product.category}
        </p>

        <h3 className="text-sm font-semibold text-gray-900 truncate leading-tight">
          {product.productName}
        </h3>

        <p className="text-base font-bold tracking-tight tabular-nums" style={{ color: primaryColor }}>
          {formatPrice(product.sellingPrice)}
        </p>

        {/* Action Button */}
        <button
          onClick={handleAddToCart}
          className="w-full py-2.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 mt-2"
          style={{
            backgroundColor: isOutOfStock ? '#E5E7EB' : (justAdded ? '#16a34a' : primaryColor),
            color: isOutOfStock ? '#9CA3AF' : 'white'
          }}
          disabled={isOutOfStock || isAddingToCart}
        >
          {isOutOfStock ? (
            'Out of stock'
          ) : isAddingToCart ? (
            <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : justAdded ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Added
            </>
          ) : product.hasVariants ? (
            'Select options'
          ) : (
            <>
              <ShoppingCart className="w-3.5 h-3.5" />
              Add to cart
            </>
          )}
        </button>
      </div>

      {/* Bottom accent line */}
      <div 
        className="h-1 w-0 group-hover:w-full transition-all duration-500 mx-auto"
        style={{ backgroundColor: primaryColor }}
      />

      <style jsx>{`
        .shimmer-animation {
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
