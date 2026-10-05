"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Button from "@/components/ui/Button";
import ListingPlanPicker from "@/components/dashboard/ListingPlanPicker";
import FullStorePlanPicker from "@/components/dashboard/FullStorePlanPicker";
import { CheckCircle2, AlertCircle, Clock, ArrowUpRight, Loader2 } from "lucide-react";

const CYCLE_UNIT_LABEL = { monthly: '/month', '3month': '/3 months', '6month': '/6 months', annual: '/year' };
const CYCLE_CADENCE_LABEL = { monthly: 'every month', '3month': 'every 3 months', '6month': 'every 6 months', annual: 'every year' };

function formatGraceDate(iso) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function StatusBanner({ status, mode, awaitingConfirmation = false, graceEndsAt = null, lockedAt = null }) {
  const isListing = mode === 'listing';
  // Snapshot once at mount (a lazy useState initializer is React's
  // documented safe spot for a one-time impure call) rather than calling
  // Date.now() directly in the render body below.
  const [nowMs] = useState(() => Date.now());

  if (awaitingConfirmation) {
    return (
      <div className="flex items-center gap-2 p-3.5 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-800">
        <Clock className="w-4 h-4 flex-shrink-0" />
        Payment received. We are confirming your subscription and activation will complete shortly.
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="flex items-center gap-2 p-3.5 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-800">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        {isListing ? 'Your listing is live and visible to the public.' : 'Your full store subscription is active.'}
      </div>
    );
  }
  if (status === 'past_due') {
    // Full-store gets a short grace window (see fullStoreSubscription.js)
    // before commerce access/storefront is actually locked -- listing mode
    // has no such window yet, so graceEndsAt is only ever set for full-store.
    const graceActive = !isListing && graceEndsAt && !lockedAt && new Date(graceEndsAt).getTime() > nowMs;
    const isLocked = !isListing && !!lockedAt;

    if (graceActive) {
      return (
        <div className="flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Your last payment failed. You have until <strong>{formatGraceDate(graceEndsAt)}</strong> to resubscribe before storefront, POS, and inventory access is restricted.
        </div>
      );
    }

    if (isLocked) {
      return (
        <div className="flex items-center gap-2 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Your grace period has ended. Storefront, POS, and inventory access is restricted until you resubscribe.
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-800">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {isListing ? 'Your last payment failed. Your listing is hidden until you resubscribe.' : 'Your last payment failed. Resubscribe to keep full store billing active.'}
      </div>
    );
  }
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 p-3.5 bg-gray-100 border border-gray-200 rounded-2xl text-sm text-gray-700">
        <Clock className="w-4 h-4 flex-shrink-0" />
        {isListing ? 'Your subscription is cancelled. Resubscribe to make your listing live again.' : 'Your subscription is cancelled. Resubscribe to reactivate billing.'}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {isListing ? 'No active subscription. Subscribe to make your listing live.' : 'No active subscription. Subscribe to activate full-store billing.'}
    </div>
  );
}

// The page's one signature moment -- a receipt-style "ledger" panel (this
// app's own brand palette is literally documented as "deep ledger green"
// in globals.css) instead of another stack of competing price cards. Every
// cycle is the SAME plan at a different commitment length, not a different
// tier, so a dominant live price plus a dashed tear-line reads honestly as
// "one plan, choose how often you pay" -- the picker (pills + value props)
// stays on the ordinary white surface below it, not crammed inside the
// dark panel where its light-toned internals wouldn't have contrast.
function LedgerPanel({ planName, priceLabel, unitLabel, cadenceLabel, savingsPercent, nextChargeLabel }) {
  return (
    <div className="rounded-2xl bg-brand-900 px-6 py-6 sm:px-8 sm:py-7">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-300">{planName}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-bold text-gold-400 [font-variant-numeric:tabular-nums]">{priceLabel}</span>
        <span className="text-sm text-brand-200">{unitLabel}</span>
      </div>

      <div className="my-5 border-t border-dashed border-brand-600" />

      <div className="flex items-center justify-between text-sm text-brand-100">
        <span>Billed {cadenceLabel}</span>
        {nextChargeLabel ? (
          <span className="text-brand-200">{nextChargeLabel}</span>
        ) : savingsPercent > 0 ? (
          <span className="font-semibold text-gold-400">You save {savingsPercent}%</span>
        ) : null}
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isUpgrade, setIsUpgrade] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [paymentReference, setPaymentReference] = useState(null);
  const [hasTriggeredConfirm, setHasTriggeredConfirm] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState('monthly');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsUpgrade(params.get('upgrade') === '1');
    const paymentSucceeded = params.get('status') === 'success';
    const reference = params.get('reference') || params.get('trxref');
    setJustPaid(paymentSucceeded);
    setPaymentReference(reference);
  }, []);

  const { data: subData, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => secureApiCall('/api/subscription'),
    staleTime: justPaid ? 0 : 60 * 1000,
    refetchInterval: justPaid ? 3000 : false,
    refetchIntervalInBackground: false
  });

  const sub = subData?.data;
  const pendingReference = sub?.pendingReference || null;

  // Defaults full-store vendors onto the 3-month tier (listing has no
  // 3-month option, so it keeps the flat 'monthly' default) -- a ref guard
  // runs this exactly once, the moment platformMode is first known, so it
  // never overrides a cycle the vendor has since picked themselves.
  const hasSetDefaultCycleRef = useRef(false);
  useEffect(() => {
    if (hasSetDefaultCycleRef.current || !sub?.platformMode) return;
    hasSetDefaultCycleRef.current = true;
    if (sub.platformMode === 'store') {
      const raf = requestAnimationFrame(() => setSelectedCycle('3month'));
      return () => cancelAnimationFrame(raf);
    }
  }, [sub?.platformMode]);

  useEffect(() => {
    if (sub?.subscriptionStatus === 'active') {
      setJustPaid(false);
    }
  }, [sub?.subscriptionStatus]);

  const subscribeMutation = useMutation({
    mutationFn: () => secureApiCall('/api/subscription', {
      method: 'POST',
      body: JSON.stringify({ cycle: selectedCycle })
    }),
    onSuccess: (data) => {
      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    }
  });

  const confirmMutation = useMutation({
    mutationFn: (reference) => secureApiCall('/api/subscription/confirm', {
      method: 'POST',
      body: JSON.stringify({ reference })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['store'] });
    }
  });

  useEffect(() => {
    if (!justPaid || hasTriggeredConfirm) return;

    const referenceForConfirm = paymentReference || pendingReference || null;
    if (!referenceForConfirm) return;

    setHasTriggeredConfirm(true);
    confirmMutation.mutate(referenceForConfirm);
  }, [justPaid, paymentReference, pendingReference, hasTriggeredConfirm]);

  const cancelMutation = useMutation({
    mutationFn: () => secureApiCall('/api/subscription/cancel', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['store'] });
      setConfirmCancel(false);
    }
  });

  const upgradeMutation = useMutation({
    mutationFn: () => secureApiCall('/api/subscription/upgrade', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store'] });
      router.push('/dashboard/overview');
    }
  });

  const downgradeMutation = useMutation({
    mutationFn: () => secureApiCall('/api/subscription/downgrade', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      setConfirmDowngrade(false);
    }
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Subscription">
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  const isActive = sub?.subscriptionStatus === 'active';
  const isListing = sub?.platformMode === 'listing';
  const amountKobo = Number.isFinite(sub?.subscriptionAmountKobo) ? sub.subscriptionAmountKobo : null;
  const amountLabel = amountKobo ? `₦${(amountKobo / 100).toLocaleString()}` : 'Plan rate';
  const planName = isListing ? 'Business Listing' : 'Full Store';
  const awaitingConfirmation = Boolean(justPaid && isListing && !isActive);
  const selectedPlan = isListing ? sub?.listingPlans?.[selectedCycle] : sub?.fullStorePlans?.[selectedCycle];
  const selectedPlanLabel = selectedPlan ? `₦${(selectedPlan.amountKobo / 100).toLocaleString()}${CYCLE_UNIT_LABEL[selectedCycle]}` : `${amountLabel}/month`;

  const nextChargeLabel = sub?.subscriptionNextPaymentDate
    ? `Next charge ${new Date(sub.subscriptionNextPaymentDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : null;

  return (
    <DashboardLayout title="Subscription" subtitle={isListing ? 'Manage your listing subscription' : 'Manage your full-store subscription'}>
      <div className="space-y-6">

        <StatusBanner
          status={sub?.subscriptionStatus}
          mode={sub?.platformMode}
          awaitingConfirmation={awaitingConfirmation}
          graceEndsAt={sub?.fullStoreSubscriptionGraceEndsAt}
          lockedAt={sub?.fullStoreSubscriptionLockedAt}
        />

        {/* Plan card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-base font-semibold text-gray-900">{planName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isListing
                ? 'Showcase page, gallery, contact info'
                : 'Products, checkout, and full commerce tools'}
            </p>
          </div>

          {awaitingConfirmation ? (
            <ul className="text-sm text-gray-600 space-y-1.5">
              {[
                'Public showcase page at your subdomain',
                'Gallery of up to 10 images',
                'Contact button (phone, WhatsApp, email)',
                'Listed in Stora browse and search'
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          ) : isActive ? (
            <>
              <LedgerPanel
                planName={planName}
                priceLabel={amountLabel}
                unitLabel={CYCLE_UNIT_LABEL[sub?.billingCycle] || '/month'}
                cadenceLabel={CYCLE_CADENCE_LABEL[sub?.billingCycle] || 'every month'}
                savingsPercent={0}
                nextChargeLabel={nextChargeLabel}
              />

              {!confirmCancel && (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="w-full text-center text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
                >
                  Cancel subscription
                </button>
              )}

              {confirmCancel && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-red-700">Your listing will be hidden immediately. Are you sure?</p>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      className="flex-1 text-sm flex items-center justify-center gap-1"
                    >
                      {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {cancelMutation.isPending ? 'Cancelling…' : 'Yes, cancel'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmCancel(false)}
                      className="flex-1 text-sm"
                    >
                      Keep it
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <LedgerPanel
                planName={planName}
                priceLabel={selectedPlan ? `₦${(selectedPlan.amountKobo / 100).toLocaleString()}` : amountLabel}
                unitLabel={CYCLE_UNIT_LABEL[selectedCycle] || '/month'}
                cadenceLabel={CYCLE_CADENCE_LABEL[selectedCycle] || 'every month'}
                savingsPercent={selectedPlan?.savingsPercent || 0}
                nextChargeLabel={null}
              />

              {isListing ? (
                <ListingPlanPicker listingPlans={sub?.listingPlans} selectedCycle={selectedCycle} onSelectCycle={setSelectedCycle} />
              ) : (
                <FullStorePlanPicker fullStorePlans={sub?.fullStorePlans} selectedCycle={selectedCycle} onSelectCycle={setSelectedCycle} />
              )}

              <Button
                variant="gold"
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
                className="w-full flex items-center justify-center gap-2"
              >
                {subscribeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {subscribeMutation.isPending ? 'Redirecting…' : `Subscribe — ${selectedPlanLabel}`}
              </Button>
            </>
          )}
        </div>

        {/* Upgrade to full store */}
        {isListing && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Upgrade to a full store</h3>
            <p className="text-xs text-gray-500 mb-4">
              List products, accept orders, and use Stora&apos;s full commerce platform
              {Number.isFinite(sub?.fullStoreSubscriptionAmountKobo)
                ? ` for a fixed ₦${(sub.fullStoreSubscriptionAmountKobo / 100).toLocaleString()}/month.`
                : '.'}
            </p>
            {isUpgrade ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Upgrading will cancel your listing subscription and switch you to the full store. Your branding, gallery, and settings will be kept.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => upgradeMutation.mutate()}
                    disabled={upgradeMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1 text-sm"
                  >
                    {upgradeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {upgradeMutation.isPending ? 'Upgrading…' : 'Confirm upgrade'}
                  </Button>
                  <Button variant="secondary" onClick={() => router.back()} className="flex-1 text-sm">
                    Go back
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => router.push('/dashboard/subscription?upgrade=1')}
                className="flex items-center gap-1 text-sm"
              >
                Learn about upgrading <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}

        {!isListing && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Switch to business listing</h3>
              <p className="text-xs text-gray-500">
                Move from full store mode to listing mode. Your profile and branding stay intact, and your listing goes live after you subscribe.
              </p>
            </div>

            {!confirmDowngrade ? (
              <Button
                variant="secondary"
                onClick={() => setConfirmDowngrade(true)}
                className="text-sm"
              >
                Switch to business listing
              </Button>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-sm text-amber-800">
                  This will switch your account to listing mode now. You can subscribe on this page immediately after to make the listing public.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => downgradeMutation.mutate()}
                    disabled={downgradeMutation.isPending}
                    className="flex-1 text-sm flex items-center justify-center gap-1"
                  >
                    {downgradeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {downgradeMutation.isPending ? 'Switching…' : 'Confirm switch'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmDowngrade(false)}
                    className="flex-1 text-sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
