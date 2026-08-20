"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Shared by every place verification surfaces (Settings' Verification tab,
// SetupChecklist, the onboarding wizard) so QOREID_CLIENT_ID/SECRET being
// unset hides all three consistently, not just one.
//
// `enabled` is `null` while loading, then `true`/`false` once resolved --
// for simply deciding whether to render something, treat both `null` and
// `false` as "don't show it yet" (there's no reason to flash the feature
// on and then yank it away once the flag resolves true-to-false never
// happens, but false-to-true on a slow connection could otherwise cause a
// flicker). The `null` vs `false` distinction only matters for the one
// caller (Settings) that needs to tell "still finding out" apart from
// "confirmed off" before correcting a stale deep link.
export function useVerificationEnabled() {
  const { secureApiCall } = useAuth();
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    let cancelled = false;
    secureApiCall('/api/config/verification').then((response) => {
      if (!cancelled && response?.success) {
        setEnabled(!!response.enabled);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return enabled;
}
