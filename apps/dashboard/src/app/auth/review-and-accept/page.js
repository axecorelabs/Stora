"use client";
import { useEffect, useState } from "react";
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
  // The session cookie Better Auth just set on the OAuth redirect back to
  // this page should already be visible to the very first checkAuth()
  // AuthContext fires on mount -- but this page is reached by a real
  // cross-site redirect from Google, right at the edge of that cookie
  // actually being set, so one retry here is cheap insurance against a
  // one-off race rather than bouncing a genuinely-just-signed-up vendor
  // straight back out on the very first check.
  const [hasRetried, setHasRetried] = useState(false);

  useEffect(() => {
    if (loading || isAuthenticated || hasRetried) return;
    checkAuth().finally(() => setHasRetried(true));
    // checkAuth's identity changes every AuthProvider render; hasRetried
    // is what actually gates this to firing at most once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated, hasRetried]);

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

  if (loading || (!isAuthenticated && !hasRetried)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-6 h-6 text-brand-800 animate-spin" />
      </div>
    );
  }

  // Still not authenticated after a retry -- a genuinely missing/expired
  // session (direct navigation, or the OAuth flow itself failed), not just
  // a one-off timing race. Back to the sign-up form specifically (this
  // page only exists on the Google signup path), with the same error
  // sign-in's own Google button already knows how to show.
  if (!isAuthenticated || !user) {
    router.replace("/?error=google_failed&mode=signup");
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
