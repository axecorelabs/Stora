'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Heart, MapPin, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function ProductCard({ product, primaryColor, currency, secondaryColor, onNavigate }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [liked, setLiked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [checkingWishlist, setCheckingWishlist] = useState(false);

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
          const isInWishlist = data.wishlist.items.some(item => 
            (item.product.id || item.product) === product.id
          );
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
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200 group cursor-pointer"
         onClick={handleProductClick}>
      {/* Image Container */}
      <div className="p-4 md:p-0">
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
              <span className="text-5xl">📦</span>
            </div>
          )}
          
          {/* Stock Badge */}
          {product.availableQuantity <= 0 && (
            <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              Out of Stock
            </div>
          )}
          {product.availableQuantity > 0 && product.availableQuantity <= product.reorderLevel && (
            <div className="absolute top-3 left-3 bg-yellow-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              Low Stock
            </div>
          )}

          {/* Wishlist Button - Only show if user is authenticated */}
          {/* {isAuthenticated && (
            <button
              onClick={handleWishlistToggle}
              disabled={addingToWishlist || checkingWishlist}
              className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all duration-200 disabled:opacity-50 hover:scale-110"
            >
              {addingToWishlist || checkingWishlist ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Heart 
                  className={`w-4 h-4 transition-all duration-200 ${liked ? 'fill-current scale-110' : ''}`}
                  style={liked ? { color: primaryColor } : { color: '#6B7280' }}
                  strokeWidth={liked ? 0 : 2}
                  fill={liked ? primaryColor : 'none'}
                />
              )}
            </button>
          )} */}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {/* Title */}
        <h3 className="text-xl font-semibold text-gray-900 mb-1 line-clamp-1">
          {product.productName}
        </h3>
        
        {/* Category */}
        <p className="text-sm text-gray-500 mb-3">
          {product.category}
        </p>

        {/* Price and Location Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-900">
             {formatPrice(product.sellingPrice)}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 text-gray-500">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">
              {product.location || 'Store'}
            </span>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleProductClick();
            }}
            className="flex-1 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={product.availableQuantity <= 0}
          >
            {product.availableQuantity <= 0 ? 'Out of stock' : 'Add to Cart'}
          </button>
          
          {/* Only show wishlist button in actions if user is authenticated */}
          {isAuthenticated && (
            <button
              onClick={handleWishlistToggle}
              disabled={addingToWishlist || checkingWishlist}
              className="w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {addingToWishlist || checkingWishlist ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Heart 
                  className={`w-5 h-5 transition-all duration-200 ${liked ? 'fill-current scale-110' : 'text-gray-600'}`}
                  style={liked ? { color: primaryColor } : {}}
                  strokeWidth={liked ? 0 : 2}
                  fill={liked ? primaryColor : 'none'}
                />
              )}
            </button>
          )}
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
