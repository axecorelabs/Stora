"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Landing point for a Google sign-up specifically (Better Auth's
// newUserCallbackURL, set in google/start/route.js) -- the one path that
// creates a vendor account with no Terms/Privacy checkbox at all. Every
// other signup path shows and logs that checkbox already; this is where a
// Google-created account catches up, once, before reaching /dashboard.
// Deliberately NOT wrapped in DashboardLayout -- same reasoning as
// /dashboard/onboarding (see that page's own comment): that layout would
// redirect right back here as long as legalReviewPendingAt is still set,
// which is exactly the state this page exists to clear.
export default function ReviewAndAcceptPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, checkAuth } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/legal/accept", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      await checkAuth();
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-6 h-6 text-brand-800 animate-spin" />
      </div>
    );
  }

  // Landed here without a session at all (direct navigation, expired
  // session) -- nothing to review yet, back to sign-in.
  if (!isAuthenticated || !user) {
    router.replace("/");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
          <ShieldCheck className="w-5 h-5 text-brand-700" />
        </div>
        <h1 className="font-display text-xl font-bold text-brand-900 mb-2" style={{ fontFamily: "var(--font-display)" }}>
          One more thing
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          You signed up with Google, so we haven&apos;t shown you our Terms of Service and Privacy Policy yet. Take a look, then
          confirm you agree before continuing to your dashboard.
        </p>

        <div className="flex flex-col gap-2 mb-6">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 underline hover:text-brand-800">
            Terms of Service
          </a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 underline hover:text-brand-800">
            Privacy Policy
          </a>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          type="button"
          onClick={handleAccept}
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          I agree, continue
        </button>
      </div>
    </div>
  );
}
