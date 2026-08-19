"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, X, ShieldCheck, Globe, ArrowRight, ListChecks } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NIGERIAN_STATES, isValidNigerianState } from "@stora/shared-constants";
import CustomDropdown from "@/components/ui/CustomDropdown";

// Replaces the old IncompleteStoreNudge (which only ever covered the
// operating-state case, as a banner on every dashboard page). This is
// scoped to the overview page only, and covers every genuinely
// *incomplete* item -- delivery regions is deliberately NOT one of
// these, since nationwide (the default) is already a complete, valid
// state, not a missing field the way an unset operating state is.
export default function SetupChecklist() {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  // State-row's own inline edit state -- carried over byte-for-byte from
  // IncompleteStoreNudge, which was specifically built this way after
  // feedback that a plain link out to /dashboard/store wasn't actionable
  // enough on its own.
  const [isPickingState, setIsPickingState] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [isSavingState, setIsSavingState] = useState(false);
  const [stateError, setStateError] = useState("");

  useEffect(() => {
    let cancelled = false;
    secureApiCall('/api/stores').then((response) => {
      if (cancelled) return;
      if (response?.success && response.hasStore) {
        setStore(response.data);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !store) return null;

  const needsState = !isValidNigerianState(store.state);
  const needsVerification = !store.isVerified;
  const needsWebsite = !store.website?.isEnabled;

  if (!needsState && !needsVerification && !needsWebsite) return null;

  const handleSaveState = async () => {
    if (!selectedState) return;
    setIsSavingState(true);
    setStateError("");
    const response = await secureApiCall('/api/stores', {
      method: 'PUT',
      body: JSON.stringify({ state: selectedState })
    });
    if (response?.success) {
      setStore((prev) => ({ ...prev, state: selectedState }));
      setIsPickingState(false);
    } else {
      setStateError(response?.message || 'Could not save -- try again');
    }
    setIsSavingState(false);
  };

  const doneCount = [needsState, needsVerification, needsWebsite].filter((needed) => !needed).length;
  const totalCount = 3;

  return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-100 text-brand-800 shrink-0">
          <ListChecks className="w-4.5 h-4.5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Finish setting up your store</h3>
          <p className="text-xs text-gray-500">{doneCount} of {totalCount} done</p>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {needsState && (
          <div className="px-5 py-3.5">
            {!isPickingState ? (
              <button
                onClick={() => setIsPickingState(true)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <span className="flex items-center gap-2.5 text-sm text-gray-700">
                  <MapPin className="w-4 h-4 text-gold-700 flex-shrink-0" />
                  Add your main operating state so buyers can find you
                </span>
                <span className="font-semibold text-brand-800 text-sm flex-shrink-0">Add now</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 flex-shrink-0 text-sm text-gray-700">
                  <MapPin className="w-4 h-4 text-gold-700 flex-shrink-0" />
                  Operating state
                </span>
                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  <div className="flex-1 sm:flex-none sm:w-64">
                    <CustomDropdown
                      options={NIGERIAN_STATES}
                      value={selectedState}
                      onChange={setSelectedState}
                      placeholder="Select state"
                      size="sm"
                    />
                  </div>
                  <button
                    onClick={handleSaveState}
                    disabled={!selectedState || isSavingState}
                    className="px-4 py-1.5 rounded-lg bg-brand-800 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-900 transition-colors flex-shrink-0"
                  >
                    {isSavingState ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setIsPickingState(false); setSelectedState(""); setStateError(""); }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
                    aria-label="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {stateError && <p className="w-full text-xs text-red-600 text-right">{stateError}</p>}
              </div>
            )}
          </div>
        )}

        {needsVerification && (
          <button
            onClick={() => router.push('/dashboard/verification')}
            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2.5 text-sm text-gray-700">
              <ShieldCheck className="w-4 h-4 text-gold-700 flex-shrink-0" />
              Get verified to earn the &ldquo;Verified by Stora&rdquo; badge
            </span>
            <span className="flex items-center gap-1 font-semibold text-brand-800 text-sm flex-shrink-0">
              Get verified <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        )}

        {needsWebsite && (
          <button
            onClick={() => router.push('/dashboard/website')}
            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2.5 text-sm text-gray-700">
              <Globe className="w-4 h-4 text-gold-700 flex-shrink-0" />
              Set up your website so buyers can find you online
            </span>
            <span className="flex items-center gap-1 font-semibold text-brand-800 text-sm flex-shrink-0">
              Set up <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
