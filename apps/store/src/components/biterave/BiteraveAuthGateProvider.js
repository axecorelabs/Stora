"use client";
import { createContext, useContext, useState } from "react";
import SignInModal from "@/components/auth/SignInModal";
import SignUpModal from "@/components/auth/SignUpModal";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";
import { useDeliveryState } from "@/contexts/DeliveryStateContext";

// Bundles exactly what StoreWebsite.js and SiteHeader.js each already do
// locally (their own showSignIn/showSignUp/showForgotPassword state + the
// three auth modals) into one reusable piece -- worth doing once here
// since Biterave has several pages needing it, not because the existing
// per-page pattern elsewhere is wrong.
//
// A context, not a plain hook -- /biterave/page.js and
// /biterave/[storeSlug]/page.js are Server Components (SSR'd teaser/menu
// data), so they can't call a hook themselves; they wrap their
// server-rendered content in this Client Component provider instead, and
// FoodItemCard.js (already 'use client') reads requireAuth via context
// with no prop-drilling needed through server-rendered layers.
const BiteraveAuthGateContext = createContext(() => {});

export function useRequireBiteraveAuth() {
  return useContext(BiteraveAuthGateContext);
}

export default function BiteraveAuthGateProvider({ children }) {
  const { syncToProfileOnAuth } = useDeliveryState();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const requireAuth = () => setShowSignIn(true);

  return (
    <BiteraveAuthGateContext.Provider value={requireAuth}>
      {children}

      <SignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSwitchToSignUp={() => {
          setShowSignIn(false);
          setShowSignUp(true);
        }}
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
        onSwitchToSignIn={() => {
          setShowSignUp(false);
          setShowSignIn(true);
        }}
      />
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        onBackToSignIn={() => {
          setShowForgotPassword(false);
          setShowSignIn(true);
        }}
      />
    </BiteraveAuthGateContext.Provider>
  );
}
