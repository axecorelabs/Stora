"use client";
import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NIGERIAN_STATES, isValidNigerianState } from "@stora/shared-constants";
import CustomDropdown from "@/components/ui/CustomDropdown";

// Vendor operating-state is required for new stores (enforced server-side
// at creation), but existing vendors are nudged, not blocked -- this
// disappears on its own once a valid state is on record, no dismiss
// button that would let it be ignored forever. Covers a state that's
// merely missing AND one that backfilled to something non-canonical (see
// the 20260818000004 migration's edge-case note) -- both are invisible to
// the state filter/badges the same way, so both need fixing.
//
// Previously linked to /dashboard/store and left it at that -- but that
// page opens read-only (an "Edit Store" button away from any actual
// input), and for online-only vendors the state field lives inside a card
// labeled "Online Presence," not anywhere called "Location." The banner
// pointed at a destination, not a completed task. This picks the state
// right here instead -- one dropdown, one save, no navigation.
export default function IncompleteStoreNudge() {
  const { secureApiCall } = useAuth();
  const [needsState, setNeedsState] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [selected, setSelected] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

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

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    setError("");
    const response = await secureApiCall('/api/stores', {
      method: 'PUT',
      body: JSON.stringify({ state: selected })
    });
    if (response?.success) {
      setNeedsState(false);
    } else {
      setError(response?.message || 'Could not save -- try again');
    }
    setIsSaving(false);
  };

  return (
    <div className="mb-6 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm text-brand-900">
      {!isPicking ? (
        <button
          onClick={() => setIsPicking(true)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gold-700 flex-shrink-0" />
            Add your main operating state so buyers can find you.
          </span>
          <span className="font-semibold text-brand-800 flex-shrink-0">Add now</span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 flex-shrink-0">
            <MapPin className="w-4 h-4 text-gold-700 flex-shrink-0" />
            Operating state
          </span>
          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none sm:w-64">
              <CustomDropdown
                options={NIGERIAN_STATES}
                value={selected}
                onChange={setSelected}
                placeholder="Select state"
                size="sm"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!selected || isSaving}
              className="px-4 py-1.5 rounded-lg bg-brand-800 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-900 transition-colors flex-shrink-0"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setIsPicking(false); setSelected(""); setError(""); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="w-full text-xs text-red-600 text-right">{error}</p>}
        </div>
      )}
    </div>
  );
}
