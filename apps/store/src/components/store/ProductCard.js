'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Heart, ShoppingCart, Check, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

export default function ProductCard({ product, primaryColor, currency, secondaryColor, onNavigate }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const [liked, setLiked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [checkingWishlist, setCheckingWishlist] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Check if item is in user's wishlist when component mounts
  useEffect(() => {
    const checkWishlistStatus = async () => {
      if (!isAuthenticated || !product.id) return;
      
      setCheckingWishlist(true);
      try {
        const response = await fetch('/api/wishlist', {
          credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok && data.success && data.wishlist?.items) {
          // Wishlist items are raw wishlist_items rows plus an enrichment
          // pass (supabaseWishlist.js's enrichWishlistWithProductData) --
          // there's no nested `item.product` object in this shape, only
          // `item.product_id` and (after enrichment) `item.product_data`.
          const isInWishlist = data.wishlist.items.some(item => item.product_id === product.id);
          setLiked(isInWishlist);
        }
      } catch (error) {
        console.error('Error checking wishlist status:', error);
      } finally {
        setCheckingWishlist(false);
      }
    };

    checkWishlistStatus();
  }, [isAuthenticated, product.id]);

  const formatPrice = (price) => {
    if (currency === 'NGN') {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
  };

  const handleProductClick = () => {
    // Extract store slug from current pathname
    if (onNavigate) onNavigate();
    const storeSlug = pathname.split('/')[1];
    router.push(`/${storeSlug}/product/${product.id}`);
  };

  // Adds directly to cart for a simple (no-variant) product -- a variant
  // product still needs the size/color picker, which only lives on the
  // product detail page, so this sends those straight there instead of
  // pretending "Add to cart" worked without asking which one.
  const handleAddToCart = async (e) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      const storeSlug = pathname.split('/')[1];
      router.push(`/${storeSlug}?signin=true`);
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

  const handleWishlistToggle = async (e) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      // Redirect to sign in
      const storeSlug = pathname.split('/')[1];
      router.push(`/${storeSlug}?signin=true`);
      return;
    }

    setAddingToWishlist(true);
    
    try {
      if (liked) {
        // Remove from wishlist
        const response = await fetch(`/api/wishlist/${product.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (response.ok) {
          setLiked(false);
        } else {
          console.error('Failed to remove from wishlist');
        }
      } else {
        // Add to wishlist
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            productId: product.id,
            priority: 'medium',
            notes: '',
            notifications: {
              priceDropAlert: true,
              backInStockAlert: true
            }
          })
        });
        
        if (response.ok) {
          setLiked(true);
        } else {
          console.error('Failed to add to wishlist');
        }
      }
    } catch (error) {
      console.error('Error updating wishlist:', error);
    } finally {
      setAddingToWishlist(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
         onClick={handleProductClick}>
      {/* Image Container */}
      <div className="p-3 md:p-0">
        <div className="relative w-full aspect-square rounded-xl overflow-hidden"
          style={{
            backgroundColor: secondaryColor || '#F3F4F6'
          }}
        >
          {product.image ? (
            <>
              {/* Loading skeleton with glassmorphism */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100/80 to-gray-200/80 backdrop-blur-sm animate-pulse">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                       style={{
                         backgroundSize: '200% 100%',
                         animation: 'shimmer 2s infinite'
                       }}
                  />
                </div>
              )}

              <img
                src={product.image}
                alt={product.productName}
                className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Package className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
            </div>
          )}

          {/* Stock Badge */}
          {product.availableQuantity <= 0 && (
            <div className="absolute top-2.5 left-2.5 bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
              Out of stock
            </div>
          )}
          {product.availableQuantity > 0 && product.availableQuantity <= product.reorderLevel && (
            <div className="absolute top-2.5 left-2.5 bg-gold-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
              Low stock
            </div>
          )}

          {/* Wishlist Button - Only show if user is authenticated */}
          {isAuthenticated && (
            <button
              onClick={handleWishlistToggle}
              disabled={addingToWishlist || checkingWishlist}
              className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-all duration-200 disabled:opacity-50"
            >
              {addingToWishlist || checkingWishlist ? (
                <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Heart
                  className={`w-4 h-4 transition-all duration-200 ${liked ? 'fill-current scale-110' : ''}`}
                  style={liked ? { color: primaryColor } : { color: '#6B7280' }}
                  strokeWidth={liked ? 0 : 2}
                  fill={liked ? primaryColor : 'none'}
                />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3.5 md:px-4 pb-3.5 md:pb-4">
        {/* Category */}
        <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">
          {product.category}
        </p>

        {/* Title */}
        <h3 className="text-[15px] font-semibold text-gray-900 mb-2 line-clamp-1">
          {product.productName}
        </h3>

        {/* Price */}
        <p className="text-lg font-bold mb-3.5 tabular-nums" style={{ color: primaryColor }}>
          {formatPrice(product.sellingPrice)}
        </p>

        {/* Buttons Row */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddToCart}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            style={{ backgroundColor: justAdded ? '#16a34a' : primaryColor }}
            disabled={product.availableQuantity <= 0 || isAddingToCart}
          >
            {product.availableQuantity <= 0 ? (
              'Out of stock'
            ) : isAddingToCart ? (
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
