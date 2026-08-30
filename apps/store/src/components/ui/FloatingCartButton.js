"use client";
import { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import useStoreStore from '@/stores/storeStore';
import { storeHref } from '@/lib/storeUrl';

export default function FloatingCartButton({ onNavigate, onSignInRequired }) {
  const router = useRouter();
  const pathname = usePathname();
  const { getCartCount } = useCart();
  const { isAuthenticated } = useAuth();
  const { currentStore } = useStoreStore();
  const [showPulse, setShowPulse] = useState(true);
  
  const primaryColor = currentStore?.branding?.primaryColor || '#0D9488';
  const cartCount = getCartCount();
  
  // From actual store data, not the URL -- see StoreHeader's comment on
  // the same fix for why pathname-derived slugs break on a vendor
  // subdomain.
  const storeSlug = currentStore?.storeSlug;

  // Stop pulse animation after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPulse(false);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Don't show on cart page
  if (pathname.includes('/cart')) {
    return null;
  }

  const handleClick = () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Trigger sign in modal if callback is provided
      if (onSignInRequired) {
        onSignInRequired();
      }
      return;
    }
    
    // User is authenticated, proceed with navigation
    if (onNavigate) onNavigate();
    router.push(storeHref(storeSlug, '/cart'));
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-40 transition-all duration-300 hover:scale-110 active:scale-95 group"
      style={{ backgroundColor: primaryColor }}
      aria-label="View cart"
    >
      {/* Ripple effect - only show for 5 seconds */}
      {showPulse && (
        <div 
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ backgroundColor: primaryColor }}
        />
      )}
      
      {/* Cart Icon */}
      <div className="relative z-10">
        <ShoppingCart className="w-7 h-7 text-white" strokeWidth={2.5} />
        
        {/* Cart Count Badge */}
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full mb-2 right-0 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        View Cart {cartCount > 0 && `(${cartCount})`}
        <div 
          className="absolute top-full right-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
        />
      </div>
    </button>
  );
}
