"use client";
import { useEffect, useState } from "react";
import { MapPin, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isValidNigerianState } from "@stora/shared-constants";

// Vendor operating-state is required for new stores (enforced server-side
// at creation), but existing vendors are nudged, not blocked -- this
// disappears on its own once a valid state is on record, no dismiss
// button that would let it be ignored forever. Covers a state that's
// merely missing AND one that backfilled to something non-canonical (see
// the 20260818000004 migration's edge-case note) -- both are invisible to
// the state filter/badges the same way, so both need fixing.
export default function IncompleteStoreNudge() {
  const { secureApiCall } = useAuth();
  const [needsState, setNeedsState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    secureApiCall('/api/stores').then((response) => {
      if (cancelled) return;
      if (response?.success && response.hasStore) {
        setNeedsState(!isValidNigerianState(response.data?.state));
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!needsState) return null;

  return (
    <a
      href="/dashboard/store"
      className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm text-brand-900 hover:bg-gold-500/15 transition-colors"
    >
      <span className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-gold-700 flex-shrink-0" />
        Add your main operating state so buyers can find you.
      </span>
      <span className="flex items-center gap-1 font-semibold text-brand-800 flex-shrink-0">
        Add now
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </a>
  );
}
