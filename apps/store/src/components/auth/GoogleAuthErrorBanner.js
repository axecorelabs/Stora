"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const MESSAGES = {
  google_cancelled: "Google sign-in was cancelled.",
  state_mismatch: "Sign-in failed, please try again.",
  google_failed: "Google sign-in failed, please try again.",
  google_email_unverified: "Your Google account's email isn't verified. Please verify it with Google and try again.",
  account_deactivated: "This account has been deactivated.",
  server_error: "Something went wrong, please try again."
};

function GoogleAuthErrorBannerInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(() => {
    const code = searchParams.get("authError");
    return code ? MESSAGES[code] || MESSAGES.server_error : null;
  });

  useEffect(() => {
    if (!searchParams.get("authError")) return;

    const params = new URLSearchParams(searchParams);
    params.delete("authError");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!message) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
      <span>{message}</span>
      <button onClick={() => setMessage(null)} className="text-red-400 hover:text-red-600 font-medium">
        ✕
      </button>
    </div>
  );
}

export default function GoogleAuthErrorBanner() {
  return (
    <Suspense fallback={null}>
      <GoogleAuthErrorBannerInner />
    </Suspense>
  );
}
