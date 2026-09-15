"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Button from "@/components/ui/Button";
import { CheckCircle2, AlertCircle, Clock, ArrowUpRight, Loader2 } from "lucide-react";

function StatusBanner({ status, awaitingConfirmation = false }) {
  if (awaitingConfirmation) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
        <Clock className="w-4 h-4 flex-shrink-0" />
        Payment received. We are confirming your subscription and your listing will go live shortly.
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        Your listing is live and visible to the public.
      </div>
    );
  }
  if (status === 'past_due') {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        Your last payment failed. Your listing is hidden until you resubscribe.
      </div>
    );
  }
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-700">
        <Clock className="w-4 h-4 flex-shrink-0" />
        Your subscription is cancelled. Resubscribe to make your listing live again.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      No active subscription. Subscribe to make your listing live.
    </div>
  );
}

export default function SubscriptionPage() {
  const { secureApiCall, user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isUpgrade = searchParams.get('upgrade') === '1';
  const justPaid = searchParams.get('status') === 'success';
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: subData, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => secureApiCall('/api/subscription'),
    staleTime: 60 * 1000
  });

  const sub = subData?.data;

  const subscribeMutation = useMutation({
    mutationFn: () => secureApiCall('/api/subscription', { method: 'POST' }),
    onSuccess: (data) => {
      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    }
  });

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
  const awaitingConfirmation = Boolean(justPaid && isListing && !isActive);

  return (
    <DashboardLayout title="Subscription" subtitle="Manage your listing subscription">
      <div className="space-y-6">

        {isListing && <StatusBanner status={sub?.subscriptionStatus} awaitingConfirmation={awaitingConfirmation} />}

        {/* Plan card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Business Listing</h2>
              <p className="text-xs text-gray-500 mt-0.5">Showcase page, gallery, contact info</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900">₦500</p>
              <p className="text-xs text-gray-500">/ month</p>
            </div>
          </div>

          {sub?.subscriptionNextPaymentDate && isActive && (
            <p className="text-xs text-gray-500">
              Next charge: {new Date(sub.subscriptionNextPaymentDate).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
          )}

          <ul className="text-sm text-gray-600 space-y-1.5">
            {[
              'Public showcase page at your subdomain',
              'Gallery of up to 10 images',
              'Contact button (phone, WhatsApp, email)',
              'Listed in Stora browse and search',
            ].map(f => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {isListing && !isActive && !awaitingConfirmation && (
            <Button
              variant="primary"
              onClick={() => subscribeMutation.mutate()}
              disabled={subscribeMutation.isPending}
              className="w-full flex items-center justify-center gap-2"
            >
              {subscribeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {subscribeMutation.isPending ? 'Redirecting…' : 'Subscribe — ₦500/month'}
            </Button>
          )}

          {isActive && !confirmCancel && (
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
        </div>

        {/* Upgrade to full store */}
        {isListing && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Upgrade to a full store</h3>
            <p className="text-xs text-gray-500 mb-4">
              List products, accept orders, and use Stora&apos;s full commerce platform. Commission-based — no fixed monthly fee.
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
      </div>
    </DashboardLayout>
  );
}
