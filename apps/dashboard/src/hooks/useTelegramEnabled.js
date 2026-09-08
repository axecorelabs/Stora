"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Mirrors useVerificationEnabled.js exactly -- `enabled` is `null` while
// loading, then `true`/`false` once resolved. Treat `null` and `false`
// alike for "don't show the Telegram tab yet" (there's no reason to flash
// it on then yank it away once the flag resolves).
export function useTelegramEnabled() {
  const { secureApiCall } = useAuth();
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    let cancelled = false;
    secureApiCall('/api/config/telegram').then((response) => {
      if (!cancelled && response?.success) {
        setEnabled(!!response.enabled);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return enabled;
}
