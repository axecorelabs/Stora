"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Same shape check as google/start/route.js's isSafeReturnTo -- returnTo
// here only ever drives a client-side router.push (not a raw HTTP
// redirect), but validated the same way anyway rather than trusting a
// query param by a different standard than the rest of the auth flow.
function isSafeReturnTo(path) {
  return typeof path === "string"
    && path.startsWith("/")
    && !path.startsWith("//")
    && !path.includes("\\")
    && !/^\/[^/]*:/.test(path);
}

// Landing point for a Google sign-up specifically (Better Auth's
// newUserCallbackURL, set in google/start/route.js) -- the one path that
// creates an account with no Terms/Privacy checkbox at all. Every other
// signup path shows and logs that checkbox already; this is where a
// Google-created account catches up, once, before using the rest of the
// site. See LegalReviewGate.js for what re-routes an account here if this
// step is ever skipped (tab closed, back button, etc).
function ReviewAndAcceptInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer, isLoading, updateCustomer } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : "/";

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
      updateCustomer({ legal_review_pending_at: null });
      router.push(returnTo);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-brand-700 animate-spin" />
      </div>
    );
  }

  // Landed here without a session at all (direct navigation, expired
  // session) -- nothing to review yet, back to the homepage to sign in.
  if (!customer) {
    router.replace("/");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
          <ShieldCheck className="w-5 h-5 text-brand-700" />
        </div>
        <h1 className="font-display text-xl font-bold text-brand-900 mb-2">One more thing</h1>
        <p className="text-sm text-gray-600 mb-6">
          You signed up with Google, so we haven&apos;t shown you our Terms of Service and Privacy Policy yet. Take a look, then
          confirm you agree before continuing.
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

export default function ReviewAndAcceptPage() {
  return (
    <Suspense fallback={null}>
      <ReviewAndAcceptInner />
    </Suspense>
  );
}
