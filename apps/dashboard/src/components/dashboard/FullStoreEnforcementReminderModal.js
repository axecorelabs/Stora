"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X, Receipt, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import FullStorePlanPicker from "./FullStorePlanPicker";

// Shown once per session (sessionStorage, not localStorage -- reappears on
// the next real login, same spirit as PartnershipProposalModal.js's own
// per-mount-cycle dismissal) to full-store vendors who haven't subscribed
// yet, ahead of the commerce-access enforcement switch
// (fullStoreSubscription.js). Self-contained like that same sibling modal:
// mounted unconditionally in DashboardLayout.js, decides for itself
// whether it has anything to show. Shares the ['subscription'] query key
// with /dashboard/subscription -- visiting that page next reads from the
// same warm cache instead of refetching.
const DISMISS_KEY = "stora-full-store-enforcement-modal-dismissed";

export default function FullStoreEnforcementReminderModal() {
  const { secureApiCall, isAuthenticated } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(true);
  // Full-store only (this modal never shows for listing mode), so a flat
  // default is safe here unlike the shared subscription page.
  const [selectedCycle, setSelectedCycle] = useState('3month');
  // Snapshot once at mount (a lazy useState initializer is React's
  // documented safe spot for a one-time impure call) rather than calling
  // Date.now() directly in the render body below -- same pattern this
  // page's own StatusBanner already uses.
  const [nowMs] = useState(() => Date.now());

  const { data: subData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => secureApiCall('/api/subscription'),
    enabled: isAuthenticated,
    staleTime: 60 * 1000
  });

  // Same mutation shape as /dashboard/subscription's own subscribeMutation
  // -- for a vendor who'd rather act now than wait out the countdown, this
  // sends them straight into Paystack checkout without leaving the modal
  // first. queryClient (not just a redirect) matters here since the
  // callback_url lands them back on /dashboard/subscription, which reads
  // the same ['subscription'] query key this modal already warmed.
  const subscribeMutation = useMutation({
    mutationFn: () => secureApiCall('/api/subscription', {
      method: 'POST',
      body: JSON.stringify({ cycle: selectedCycle })
    }),
    onSuccess: (data) => {
      if (data?.authorizationUrl) {
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        window.location.href = data.authorizationUrl;
      }
    }
  });

  useEffect(() => {
    // Deferred into a rAF callback (not called synchronously in the effect
    // body) -- same pattern used elsewhere in this app (e.g.
    // ShowcaseBackButton.js) for a one-time client-only read.
    const raf = requestAnimationFrame(() => {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const sub = subData?.data;
  const shouldShow = !dismissed && sub?.platformMode === 'store' && sub?.subscriptionStatus !== 'active';

  if (!shouldShow) return null;

  const enforcementDate = sub.fullStoreEnforcementStartsAt ? new Date(sub.fullStoreEnforcementStartsAt) : null;
  const isPast = !!enforcementDate && nowMs >= enforcementDate.getTime();
  const dateLabel = enforcementDate
    ? enforcementDate.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const daysLeft = enforcementDate && !isPast
    ? Math.ceil((enforcementDate.getTime() - nowMs) / (24 * 60 * 60 * 1000))
    : null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const viewPlans = () => {
    dismiss();
    router.push('/dashboard/subscription');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full relative overflow-hidden max-h-[90dvh] overflow-y-auto">
        {/* Dark ledger band -- same brand-900/gold treatment as the
            subscription page's price panel, so this reads as a preview of
            that page rather than an unrelated alert. */}
        <div className="bg-brand-900 px-6 pt-6 pb-7 sm:px-7 sm:pt-7 relative">
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-brand-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mb-4">
            <Receipt className="w-5 h-5 text-gold-400" />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-300 mb-1.5">
            {isPast ? 'Subscription required' : 'Heads up'}
          </p>
          <h2 className="font-display text-xl font-bold text-white leading-snug pr-6">
            {isPast ? (
              'Your full-store subscription is required'
            ) : (
              <>Your full-store subscription starts <span className="text-gold-400">{dateLabel}</span></>
            )}
          </h2>
        </div>

        <div className="px-6 py-6 sm:px-7">
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            {isPast
              ? 'Subscribe now to restore your storefront, POS, inventory, and payouts.'
              : `Your storefront, POS, inventory, and payouts stay fully active until then${daysLeft != null && daysLeft > 0 ? ` -- ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}. This is advance notice, not a charge.`}
          </p>

          <FullStorePlanPicker fullStorePlans={sub.fullStorePlans} selectedCycle={selectedCycle} onSelectCycle={setSelectedCycle} />

          <button
            onClick={() => subscribeMutation.mutate()}
            disabled={subscribeMutation.isPending}
            className="w-full mt-6 rounded-xl bg-gold-500 text-brand-900 text-sm font-semibold py-3 hover:bg-gold-400 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {subscribeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {subscribeMutation.isPending
              ? 'Redirecting…'
              : `Subscribe now — ${sub.fullStorePlans?.[selectedCycle] ? `₦${(sub.fullStorePlans[selectedCycle].amountKobo / 100).toLocaleString()}` : ''}`}
          </button>

          {subscribeMutation.isError && (
            <p className="text-xs text-red-600 mt-2 text-center">Something went wrong -- please try again.</p>
          )}

          <button
            onClick={viewPlans}
            className="w-full text-center text-xs text-brand-700 hover:text-brand-900 mt-4 py-1 font-medium"
          >
            View full plan details
          </button>
          <button
            onClick={dismiss}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-1 py-1"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
