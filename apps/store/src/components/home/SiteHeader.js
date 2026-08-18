"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag, Heart, User, Menu, X, Package, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useDeliveryState } from "@/contexts/DeliveryStateContext";
import SignInModal from "@/components/auth/SignInModal";
import SignUpModal from "@/components/auth/SignUpModal";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import { DeliveryStatePickerDesktop, DeliveryStatePickerMobile } from "@/components/home/DeliveryStatePicker";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.stora.com.ng";
const BRAND_PRIMARY = "#145C41";

// Stora's own header, not a vendor's -- same account/cart/wishlist affordances
// as components/store/StoreHeader.js (that one is what shoppers see once
// they're inside a vendor's storefront), just without anything store-specific
// (no per-vendor logo/colors, no in-header product search -- the hero below
// already owns that job on this page).
export default function SiteHeader() {
  const router = useRouter();
  const { customer, isAuthenticated, isLoading: authLoading, logout, setRedirectAfterLogin } = useAuth();
  const { getCartCount } = useCart();
  const cartCount = getCartCount();
  const { syncToProfileOnAuth } = useDeliveryState();

  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleSwitchToSignUp = () => {
    setShowSignIn(false);
    setShowSignUp(true);
  };

  const handleSwitchToSignIn = () => {
    setShowSignUp(false);
    setShowSignIn(true);
  };

  const handleSignOut = async () => {
    await logout();
    setShowAccountMenu(false);
    setShowMobileMenu(false);
  };

  // Cart and wishlist both need a real customer session -- rather than
  // navigating and letting the destination page bounce them back (which is
  // what happens today if you're logged out), queue the intended
  // destination and open sign-in right here, so a successful login lands
  // them exactly where they meant to go.
  const goAuthed = (path) => {
    if (authLoading) return;
    setShowMobileMenu(false);
    if (!isAuthenticated) {
      setRedirectAfterLogin(path);
      setShowSignIn(true);
    } else {
      setIsNavigating(true);
      router.push(path);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-brand-800/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/stora-icon.png" alt="" width={20} height={24} className="h-6 w-auto" priority />
            <span className="font-display text-xl font-bold text-white tracking-tight">stora</span>
          </Link>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-1">
            <DeliveryStatePickerDesktop />

            <a
              href={DASHBOARD_URL}
              className="text-sm font-medium text-white/70 hover:text-white transition-colors px-3 py-2"
            >
              Sell on Stora
            </a>

            <button
              onClick={() => goAuthed("/wishlist")}
              className="p-2.5 text-white/80 hover:text-white transition-colors"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
            </button>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setShowAccountMenu((v) => !v)}
                  className="flex items-center gap-2 p-2.5 text-white/80 hover:text-white transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium hidden lg:inline">
                    {customer?.firstName || "Account"}
                  </span>
                </button>

                {showAccountMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">
                        {customer?.fullName || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim()}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{customer?.email}</p>
                    </div>

                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        setIsNavigating(true);
                        router.push("/orders");
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
                        router.push("/wishlist");
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Heart className="w-4 h-4" />
                      Wishlist
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
                onClick={() => setShowSignIn(true)}
                className="flex items-center gap-1.5 p-2.5 text-white/80 hover:text-white transition-colors"
              >
                <User className="w-5 h-5" />
                <span className="text-sm font-medium hidden lg:inline">Sign In</span>
              </button>
            )}

            <button onClick={() => goAuthed("/cart")} className="relative p-2.5 text-white/90 hover:text-white transition-colors">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-gold-500 text-brand-900 text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile: cart + hamburger only */}
          <div className="flex sm:hidden items-center gap-1">
            <button onClick={() => goAuthed("/cart")} className="relative p-2 text-white/90">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-gold-500 text-brand-900 text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowMobileMenu(true)} className="p-2 text-white/90" aria-label="Menu">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-in menu */}
      {showMobileMenu && (
        <>
          <div
            className="fixed inset-0 z-50 sm:hidden"
            onClick={() => setShowMobileMenu(false)}
            style={{ backdropFilter: "blur(2px)", backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          />
          <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-50 sm:hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Image src="/stora-icon.png" alt="" width={18} height={21} className="h-5 w-auto" />
                <span className="font-display text-lg font-bold text-brand-900">stora</span>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <DeliveryStatePickerMobile />

              {isAuthenticated ? (
                <div className="pb-6 border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-50">
                      <User className="w-6 h-6 text-brand-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {customer?.firstName} {customer?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{customer?.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setShowMobileMenu(false);
                        setIsNavigating(true);
                        router.push("/orders");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
                    >
                      <Package className="w-5 h-5 text-gray-500" />
                      <span className="font-medium">My Orders</span>
                    </button>

                    <button
                      onClick={() => goAuthed("/wishlist")}
                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
                    >
                      <Heart className="w-5 h-5 text-gray-500" />
                      <span className="font-medium">Wishlist</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pb-6 border-b border-gray-100">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 bg-brand-50">
                      <User className="w-8 h-8 text-brand-700" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">Welcome!</h3>
                    <p className="text-sm text-gray-500">Sign in to access your account</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowSignIn(true);
                    }}
                    className="w-full py-3 px-4 text-white rounded-xl font-semibold transition-colors hover:opacity-90"
                    style={{ backgroundColor: BRAND_PRIMARY }}
                  >
                    Sign In
                  </button>
                </div>
              )}

              <div className="pb-6 border-b border-gray-100">
                <button
                  onClick={() => goAuthed("/cart")}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Shopping Cart</span>
                  </div>
                  {cartCount > 0 && (
                    <span
                      className="px-2.5 py-1 text-white text-sm font-semibold rounded-full"
                      style={{ backgroundColor: BRAND_PRIMARY }}
                    >
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                <a
                  href={DASHBOARD_URL}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
                >
                  <Package className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">Sell on Stora</span>
                </a>
              </div>

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
          syncToProfileOnAuth();
        }}
      />

      <SignUpModal
        isOpen={showSignUp}
        onClose={() => setShowSignUp(false)}
        onSuccess={() => {
          setShowSignUp(false);
          syncToProfileOnAuth();
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

      {showAccountMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
      )}

      <LoadingOverlay isVisible={isNavigating} color={BRAND_PRIMARY} message="Loading..." />
    </>
  );
}
