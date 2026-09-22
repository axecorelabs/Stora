"use client";
import { useState } from "react";
import { BadgeCheck, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

// Only reachable from the checklist while platformMode === 'listing' (see
// needsSubscription in SetupChecklist.js) -- the full-store plan has no
// equivalent "not yet subscribed" checklist item, so this only ever
// covers the ₦500/mo listing plan, same amount as POST /api/subscription's
// own hardcoded kobo value.
export default function SubscriptionModal({ isOpen, onClose }) {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    setError(null);
    try {
      const response = await secureApiCall('/api/subscription', { method: 'POST' });
      if (response?.authorizationUrl) {
        window.location.href = response.authorizationUrl;
      } else {
        setError(response?.message || 'Could not start checkout');
        setIsSubscribing(false);
      }
    } catch {
      setError('Could not start checkout');
      setIsSubscribing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Activate your listing"
      subtitle="Go live publicly"
      icon={BadgeCheck}
      iconTone="gold"
      footer={
        <button
          onClick={() => router.push('/dashboard/subscription')}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-1"
        >
          View subscription details <ArrowRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-gold-200 bg-gold-50/50 p-4">
          <p className="flex items-baseline gap-1">
            <span className="font-display text-2xl font-bold text-gray-900">₦500</span>
            <span className="text-sm text-gray-500">/month</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-gold-600 shrink-0" />
              Your listing is visible to buyers
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-gold-600 shrink-0" />
              Cancel anytime from Subscription settings
            </li>
          </ul>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <Button variant="gold" onClick={handleSubscribe} disabled={isSubscribing} className="w-full">
          {isSubscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isSubscribing ? 'Redirecting…' : 'Subscribe — ₦500/month'}
        </Button>
      </div>
    </Modal>
  );
}
