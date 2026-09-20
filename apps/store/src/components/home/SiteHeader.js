"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag, Heart, User, Menu, X, Package, Store, LogOut, UtensilsCrossed, LayoutGrid, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useDeliveryState } from "@/contexts/DeliveryStateContext";
import SignInModal from "@/components/auth/SignInModal";
import SignUpModal from "@/components/auth/SignUpModal";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import { DeliveryStatePickerDesktop, DeliveryStatePickerMobile } from "@/components/home/DeliveryStatePicker";

const BRAND_PRIMARY = "#145C41";

// Stora's own header, not a vendor's -- same account/cart/wishlist affordances
// as components/store/StoreHeader.js (that one is what shoppers see once
// they're inside a vendor's storefront), just without anything store-specific
// (no per-vendor logo/colors, no in-header product search -- the hero below
// already owns that job on this page).
// brand="biterave" swaps the wordmark/home link for the Biterave section
// (apps/store/src/app/biterave/**) -- everything else about this header
// (auth, cart, wishlist, mobile menu) stays identical, so this is a prop,
// not a separate component.
export default function SiteHeader({ brand = "stora" }) {
  const router = useRouter();
  const isBiterave = brand === "biterave";
  const homeHref = isBiterave ? "/biterave" : "/";
  const brandLabel = isBiterave ? "biterave" : "stora";
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

  // The panel stays mounted at all times and animates purely off
  // showMobileMenu via CSS transform/opacity (translate-x-full when
  // closed, off-canvas) -- so this effect only touches the external DOM
  // (scroll lock), never React state, which is what a plain
  // `showMobileMenu && (...)` conditional render couldn't do: that
  // unmounts the panel the instant it closes, with no time for a
  // slide-out transition to actually play.
  useEffect(() => {
    document.body.style.overflow = showMobileMenu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showMobileMenu]);

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
          <Link href={homeHref} className="flex items-center gap-2 shrink-0">
            {isBiterave ? (
              <UtensilsCrossed className="w-5 h-5 text-gold-400" />
            ) : (
              <Image src="/stora-icon.png" alt="" width={20} height={24} className="h-6 w-auto" priority />
            )}
            <span className="font-display text-xl font-bold text-white tracking-tight">{brandLabel}</span>
          </Link>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-1">
            <DeliveryStatePickerDesktop />

            <Link
              href="/sell"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors px-3 py-2"
            >
              List Your Business
            </Link>

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

      {/* Mobile slide-in menu -- always mounted, sm:hidden keeps it out of
          the tree on desktop; on mobile it's permanently in the DOM just
          off-canvas (translate-x-full) so the transition actually plays in
          both directions instead of the panel popping in/out instantly
          (what the old `showMobileMenu && (...)` conditional render did). */}
      <>
        <div
          className={`fixed inset-0 z-50 sm:hidden transition-opacity duration-300 ease-out ${
            showMobileMenu ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setShowMobileMenu(false)}
          style={{ backdropFilter: "blur(2px)", backgroundColor: "rgba(8, 42, 32, 0.55)" }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-hidden={!showMobileMenu}
          aria-label="Menu"
          className={`fixed top-0 right-0 h-full w-full bg-white shadow-2xl z-50 sm:hidden flex flex-col transition-transform duration-300 ease-out ${
            showMobileMenu ? "translate-x-0" : "translate-x-full pointer-events-none"
          }`}
        >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center shrink-0">
                  {isBiterave ? (
                    <UtensilsCrossed className="w-4 h-4 text-gold-400" />
                  ) : (
                    <Image src="/stora-icon.png" alt="" width={18} height={21} className="h-5 w-auto" />
                  )}
                </div>
                <span className="font-display text-lg font-bold text-brand-900">{brandLabel}</span>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 -mr-2 hover:bg-gray-50 rounded-xl transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <DeliveryStatePickerMobile />

              {isAuthenticated ? (
                <div className="pb-6 border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-50">
                      <User className="w-6 h-6 text-brand-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {customer?.firstName} {customer?.lastName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{customer?.email}</p>
                    </div>
                  </div>

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
                    className="w-full py-3 px-4 bg-brand-600 text-white rounded-xl font-semibold transition-colors hover:bg-brand-700"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Quick actions -- the four things a visitor reaches for most.
                  Browse Products/Discover Businesses (Order Food/Restaurants
                  in Biterave) had no way into them from anywhere but the
                  homepage before this; Wishlist and Cart now sit alongside
                  them instead of being split across two separate blocks. */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={isBiterave ? "/biterave/meals" : "/products"}
                  onClick={() => setShowMobileMenu(false)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-brand-50 hover:bg-brand-100 transition-colors py-5 text-center"
                >
                  {isBiterave ? (
                    <UtensilsCrossed className="w-5 h-5 text-brand-700" />
                  ) : (
                    <LayoutGrid className="w-5 h-5 text-brand-700" />
                  )}
                  <span className="text-sm font-medium text-brand-900">{isBiterave ? "Order Food" : "Browse Products"}</span>
                </Link>

                <Link
                  href={isBiterave ? "/biterave/restaurants" : "/vendors"}
                  onClick={() => setShowMobileMenu(false)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-brand-50 hover:bg-brand-100 transition-colors py-5 text-center"
                >
                  <Building2 className="w-5 h-5 text-brand-700" />
                  <span className="text-sm font-medium text-brand-900">{isBiterave ? "Restaurants" : "Discover Businesses"}</span>
                </Link>

                <button
                  onClick={() => goAuthed("/wishlist")}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-brand-50 hover:bg-brand-100 transition-colors py-5 text-center"
                >
                  <Heart className="w-5 h-5 text-brand-700" />
                  <span className="text-sm font-medium text-brand-900">Wishlist</span>
                </button>

                <button
                  onClick={() => goAuthed("/cart")}
                  className="relative flex flex-col items-center justify-center gap-2 rounded-2xl bg-brand-50 hover:bg-brand-100 transition-colors py-5 text-center"
                >
                  <ShoppingBag className="w-5 h-5 text-brand-700" />
                  <span className="text-sm font-medium text-brand-900">Cart</span>
                  {cartCount > 0 && (
                    <span className="absolute top-3 right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-gold-500 text-brand-900 text-[10px] font-bold flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>

              <Link
                href="/sell"
                onClick={() => setShowMobileMenu(false)}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
              >
                <Store className="w-5 h-5 text-gray-500" />
                <span className="font-medium">List Your Business</span>
              </Link>

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
