'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, ShoppingCart, User, Menu, Heart, LogOut, Package, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import SignInModal from '../auth/SignInModal';
import SignUpModal from '../auth/SignUpModal';
import ForgotPasswordModal from '../auth/ForgotPasswordModal';
import LoadingOverlay from '../ui/LoadingOverlay';
import useStoreStore from '@/stores/storeStore';

export default function StoreHeader({ store, onSignInClick }) {
  const router = useRouter();
  const pathname = usePathname();
  const { customer, isAuthenticated, isLoading: authLoading, logout, setRedirectAfterLogin } = useAuth();
  const { getCartCount } = useCart();
  
  // Get store from Zustand store
  const { currentStore } = useStoreStore();
  const primaryColor = currentStore?.branding?.primaryColor || '#0D9488';
  
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');

  // Extract store slug from pathname
  const storeSlug = pathname.split('/')[1];

  const handleSignOut = async () => {
    await logout();
    setShowAccountMenu(false);
    setShowMobileMenu(false);
  };

  const handleSwitchToSignUp = () => {
    setShowSignIn(false);
    setShowSignUp(true);
  };

  const handleSwitchToSignIn = () => {
    setShowSignUp(false);
    setShowSignIn(true);
  };

  const handleCartClick = () => {
    if (authLoading) {
      return;
    }
    
    if (!isAuthenticated) {
      setRedirectAfterLogin(`/${storeSlug}/cart`);
      setShowSignIn(true);
    } else {
      setIsNavigating(true);
      router.push(`/${storeSlug}/cart`);
    }
    setShowMobileMenu(false);
  };

  const handleWishlistClick = () => {
    if (authLoading) {
      return;
    }
    
    if (!isAuthenticated) {
      setRedirectAfterLogin(`/${storeSlug}/wishlist`);
      setShowSignIn(true);
    } else {
      setIsNavigating(true);
      router.push(`/${storeSlug}/wishlist`);
    }
    setShowMobileMenu(false);
  };

  const handleMobileSignIn = () => {
    setShowMobileMenu(false);
    setShowSignIn(true);
  };

  const handleHeaderSearch = (e) => {
    e.preventDefault();
    if (!headerSearch.trim()) return;
    setIsNavigating(true);
    router.push(`/${storeSlug}/products?search=${encodeURIComponent(headerSearch.trim())}`);
  };


  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        {/* Main header */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 gap-6">
            
            {/* Mobile Layout: Logo/Store Name on Left, Cart + Hamburger on Right */}
            <div className="md:hidden flex items-center justify-between w-full">
              {/* Left: Logo & Store Name */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {currentStore?.branding?.logo ? (
                  <img
                    src={currentStore.branding.logo}
                    alt={currentStore.storeName}
                    className="h-8 w-auto object-contain rounded-lg shrink-0"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span className="text-white font-semibold text-sm">
                      {currentStore?.storeName?.charAt(0)?.toUpperCase() || 'S'}
                    </span>
                  </div>
                )}
                <h1 className="font-display text-xl font-semibold text-gray-900 truncate min-w-0" title={currentStore?.storeName}>
                  {currentStore?.storeName || 'Store'}
                </h1>
              </div>

              {/* Right: Wishlist Icon + Hamburger Menu */}
              <div className="flex items-center gap-2">
                {/* Wishlist Icon - Minimalistic */}
                <button 
                  onClick={handleWishlistClick}
                  className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <Heart className="w-5 h-5 text-gray-600" />
                </button>

                {/* Hamburger Menu */}
                <button 
                  onClick={() => setShowMobileMenu(true)}
                  className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <Menu className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Desktop Layout: Keep Existing Structure */}
            <div className="hidden md:flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                {currentStore?.branding?.logo ? (
                  <img
                    src={currentStore.branding.logo}
                    alt={currentStore.storeName}
                    className="h-8 w-auto object-contain rounded-lg shrink-0"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span className="text-white font-semibold text-sm">
                      {currentStore?.storeName?.charAt(0)?.toUpperCase() || 'S'}
                    </span>
                  </div>
                )}
                <h1 className="font-display text-xl font-semibold text-gray-900 truncate max-w-[16rem] min-w-0" title={currentStore?.storeName}>
                  {currentStore?.storeName || 'Store'}
                </h1>
              </div>
            </div>

            {/* Center: Search Bar (Hidden on Mobile) */}
            <form onSubmit={handleHeaderSearch} className="hidden md:flex flex-1 max-w-2xl">
              <div className="relative flex items-center w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  placeholder={`Search ${currentStore?.storeName || 'this store'}…`}
                  className="w-full px-4 py-2.5 pl-11 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent focus:bg-white transition-colors"
                  style={{ '--tw-ring-color': primaryColor }}
                />
              </div>
            </form>

            {/* Right: Actions (Hidden on Mobile) */}
            <div className="hidden md:flex items-center gap-2">
              <button 
                onClick={handleWishlistClick}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <Heart className="w-5 h-5" />
                <span className="text-sm font-medium hidden lg:inline">Wishlist</span>
              </button>
              
              {/* Account Button - Changes based on auth state */}
              {isAuthenticated ? (
                <div className="relative">
                  <button 
                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                    className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <User className="w-5 h-5" />
                    <span className="text-sm font-medium hidden lg:inline">
                      {customer?.firstName || 'Account'}
                    </span>
                  </button>

                  {/* Account Dropdown Menu */}
                  {showAccountMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">
                          {customer?.fullName || `${customer?.firstName} ${customer?.lastName}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{customer?.email}</p>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setShowAccountMenu(false);
                          setIsNavigating(true);
                          router.push(`/${storeSlug}/orders`);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Package className="w-4 h-4" />
                        My Orders
                      </button>
                      
                      <button 
                        onClick={() => {
                          setShowAccountMenu(false);
                          setIsNavigating(true);
                          router.push(`/${storeSlug}/wishlist`);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Heart className="w-4 h-4" />
                        Wishlist
                      </button>
                      
                      <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Profile Settings
                      </button>
                      
                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button 
                          onClick={handleSignOut}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  onClick={onSignInClick || (() => setShowSignIn(true))}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium hidden lg:inline">Sign In</span>
                </button>
              )}
              
              <button 
                onClick={handleCartClick}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <div className="relative flex">
                  <ShoppingCart className="w-5 h-5" />
                  {getCartCount() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-semibold">
                      {getCartCount()}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline">Cart</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-in Menu Panel */}
      {showMobileMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0  z-50 md:hidden"
            onClick={() => setShowMobileMenu(false)}
            style={{ backdropFilter: 'blur(2px)', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          />
          
          {/* Slide-in Panel */}
          <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-50 md:hidden transform transition-transform duration-300 ease-out">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                {currentStore?.branding?.logo ? (
                  <img
                    src={currentStore.branding.logo}
                    alt={currentStore.storeName}
                    className="h-8 w-auto object-contain rounded-lg shrink-0"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span className="text-white font-semibold text-sm">
                      {currentStore?.storeName?.charAt(0)?.toUpperCase() || 'S'}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm">Menu</h3>
                  <p className="text-xs text-gray-500 truncate" title={currentStore?.storeName}>{currentStore?.storeName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="p-6 space-y-6">
              {/* User Section */}
              {isAuthenticated ? (
                <div className="pb-6 border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${primaryColor}20` }}
                    >
                      <User className="w-6 h-6" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {customer?.firstName} {customer?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{customer?.email}</p>
                    </div>
                  </div>
                  
                  {/* User Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setShowMobileMenu(false);
                        setIsNavigating(true);
                        router.push(`/${storeSlug}/orders`);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
                    >
                      <Package className="w-5 h-5 text-gray-500" />
                      <span className="font-medium">My Orders</span>
                    </button>
                    
                    <button
                      onClick={handleWishlistClick}
                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
                    >
                      <Heart className="w-5 h-5 text-gray-500" />
                      <span className="font-medium">Wishlist</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowMobileMenu(false);
                        // Add profile settings navigation when ready
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
                    >
                      <User className="w-5 h-5 text-gray-500" />
                      <span className="font-medium">Profile Settings</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pb-6 border-b border-gray-100">
                  <div className="text-center mb-4">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ backgroundColor: `${primaryColor}20` }}
                    >
                      <User className="w-8 h-8" style={{ color: primaryColor }} />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">Welcome!</h3>
                    <p className="text-sm text-gray-500">Sign in to access your account</p>
                  </div>
                  
                  <button
                    onClick={handleMobileSignIn}
                    className="w-full py-3 px-4 text-white rounded-xl font-semibold transition-colors hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Cart Section */}
              <div className="pb-6 border-b border-gray-100">
                <button
                  onClick={handleCartClick}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Shopping Cart</span>
                  </div>
                  {getCartCount() > 0 && (
                    <span 
                      className="px-2.5 py-1 text-white text-sm font-semibold rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {getCartCount()}
                    </span>
                  )}
                </button>
              </div>

              {/* Store Navigation */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    setIsNavigating(true);
                    router.push(`/${storeSlug}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
                >
                  <Package className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">Browse Products</span>
                </button>
                
                {/* Add more navigation items as needed */}
              </div>

              {/* Sign Out Button (for authenticated users) */}
              {isAuthenticated && (
                <div className="pt-6 border-t border-gray-100">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <SignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSwitchToSignUp={handleSwitchToSignUp}
        onForgotPassword={() => {
          setShowSignIn(false);
          setShowForgotPassword(true);
        }}
        onSuccess={() => {
          setShowSignIn(false);
          // Navigate to store-specific redirect if set
          const redirect = sessionStorage.getItem('redirectAfterLogin');
          if (redirect && redirect.includes(storeSlug)) {
            router.push(redirect);
            sessionStorage.removeItem('redirectAfterLogin');
          }
        }}
      />

      <SignUpModal
        isOpen={showSignUp}
        onClose={() => setShowSignUp(false)}
        onSuccess={() => {
          setShowSignUp(false);
          // Navigate to store-specific redirect if set
          const redirect = sessionStorage.getItem('redirectAfterLogin');
          if (redirect && redirect.includes(storeSlug)) {
            router.push(redirect);
            sessionStorage.removeItem('redirectAfterLogin');
          }
        }}
        onSwitchToSignIn={handleSwitchToSignIn}
      />

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        onBackToSignIn={() => {
          setShowForgotPassword(false);
          setShowSignIn(true);
        }}
      />

      {/* Close account menu when clicking outside */}
      {showAccountMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowAccountMenu(false)}
        />
      )}

      {/* Loading Overlay for Navigation */}
      <LoadingOverlay 
        isVisible={isNavigating} 
        color={primaryColor}
        message="Loading..."
      />
    </>
  );

}