'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Heart, ShoppingCart, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsInWishlist, useWishlistMutations } from '@/hooks/useWishlist';

export default function ProductCardMobile({ product, primaryColor, currency, secondaryColor, onNavigate }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [imageLoaded, setImageLoaded] = useState(false);
  
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
      const storeSlug = pathname.split('/')[1];
      router.push(`/${storeSlug}?signin=true`);
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

  const isUpdating = addToWishlist.isPending || removeFromWishlist.isPending;
  const isLowStock = product.availableQuantity > 0 && product.availableQuantity <= (product.reorderLevel || 5);
  const isOutOfStock = product.availableQuantity <= 0;

  return (
    <div 
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300 group cursor-pointer active:scale-[0.98]"
      onClick={handleProductClick}
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
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
                className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
              />

              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
              <span className="text-4xl opacity-30">📦</span>
            </div>
          )}
          
          {/* Stock Badges */}
          {isOutOfStock && (
            <div className="absolute top-2 left-2 bg-gradient-to-r from-red-600 to-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              SOLD OUT
            </div>
          )}
          {isLowStock && !isOutOfStock && (
            <div
              className="absolute top-2 left-2 flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg backdrop-blur-sm"
              style={{
                background: 'linear-gradient(to right, #a9a49fcc, #b4b0a7cc)', // semi-transparent amber/orange
                // ^ 80% opacity hex
              }}
            >
              <Sparkles className="w-5 h-5" /> {/* Icon is now 20px, text is ~10px */}
              <span className="text-[10px] font-bold text-white">HURRY</span>
            </div>
          )}

          {/* Wishlist Button */}
          {isAuthenticated && (
            <button
              onClick={handleWishlistToggle}
              disabled={isUpdating}
              className="absolute top-2 right-2 w-9 h-9 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white hover:scale-110 transition-all shadow-lg disabled:opacity-50 z-10 border border-gray-100"
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

          {/* In Stock Indicator */}
          {/* {!isOutOfStock && !isLowStock && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-green-500/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
              <span>In Stock</span>
            </div>
          )} */}
        </div>
      </div>

      {/* Content - Tighter spacing with luxury fonts */}
      <div className="p-3 space-y-1">
        {/* Category Badge - More subtle */}
        <div className="flex items-center gap-2">
          {/* <span 
            className="text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide inline-block"
            style={{ 
              backgroundColor: `${primaryColor}10`,
              color: primaryColor,
              letterSpacing: '0.05em'
            }}
          >
            {product.category}
          </span> */}
          {/* {product.brand && (
            <span className="text-[10px] text-gray-400 font-medium truncate">
              {product.brand}
            </span>
          )} */}
        </div>

        {/* Title - Limit to one line */}
        <h3 
          className="text-sm font-bold text-gray-900 truncate leading-tight min-h-0 capitalize"
          style={{
            fontWeight: 700,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}
        >
          {product.productName}
        </h3>

        {/* Price - Closer to title, luxury typography */}
        <div className="flex items-baseline gap-1.5">
          <span 
            className="text-lg font-black tracking-tight"
            style={{ 
              color: primaryColor,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}
          >
            {formatPrice(product.sellingPrice)}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">
            / {product.unitOfMeasure || 'unit'}
          </span>
        </div>

        {/* Stock availability text - More compact */}
        {/* {!isOutOfStock && (
          <p className="text-[10px] text-gray-500 font-medium">
            {isLowStock 
              ? `Hurry! Only ${product.availableQuantity} left` 
              : `${product.availableQuantity} available`}
          </p>
        )} */}

        {/* Action Button - Luxury styling with letter spacing */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleProductClick();
          }}
          className="w-full py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden mt-2"
          style={{
            backgroundColor: isOutOfStock ? '#E5E7EB' : primaryColor,
            color: isOutOfStock ? '#9CA3AF' : 'white',
            fontWeight: 700,
            letterSpacing: '0.025em',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}
          disabled={isOutOfStock}
        >
          {/* Button shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          
          {isOutOfStock ? (
            <span>OUT OF STOCK</span>
          ) : (
            <>
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>ADD TO CART</span>
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
