"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// Catches every path INTO the app for an account that still has
// legal_review_pending_at set (databaseHooks.user.create.after in
// betterAuth.js flags every new customer; only email/password signup and
// the review-and-accept interstitial itself clear it) -- not just the
// moment right after a Google sign-up. Covers a closed tab, a bookmark, a
// back-button, or anything else that could otherwise leave an account
// permanently unreviewed despite the redirect google/start/route.js sends
// a fresh signup through.
function LegalReviewGateInner() {
  const { customer, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !customer) return;
    if (!customer.legal_review_pending_at) return;
    if (pathname?.startsWith("/auth/review-and-accept")) return;
    router.replace(`/auth/review-and-accept?returnTo=${encodeURIComponent(pathname || "/")}`);
  }, [isLoading, isAuthenticated, customer, pathname, router]);

  return null;
}

export default function LegalReviewGate() {
  return (
    <Suspense fallback={null}>
      <LegalReviewGateInner />
    </Suspense>
  );
}
