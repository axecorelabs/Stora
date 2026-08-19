"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Globe, MapPin, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CreateStoreModal from "@/components/dashboard/CreateStoreModal";
import Button from "@/components/ui/Button";

const GOOGLE_FALLBACK_NAMES = new Set(['Google', 'User']);

// Own minimal shell, not wrapped in DashboardLayout -- both because this
// is a distinct first-run experience (no sidebar/nav clutter) and to
// avoid a redirect loop with DashboardLayout's own
// "onboarding incomplete -> push here" effect.
export default function OnboardingPage() {
  const { user, loading, isAuthenticated, secureApiCall, checkAuth } = useAuth();
  const router = useRouter();

  // Steps: 'name' -> 'store' -> 'optional'. Always starts at 'name' --
  // there's no persisted "step 1 done" flag, so re-entering the wizard
  // (e.g. a refresh mid-flow) just re-shows a pre-filled, one-click
  // confirm rather than needing its own progress column.
  const [step, setStep] = useState('name');

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!user) return;
    setFirstName(GOOGLE_FALLBACK_NAMES.has(user.firstName) ? '' : (user.firstName || ''));
    setLastName(GOOGLE_FALLBACK_NAMES.has(user.lastName) ? '' : (user.lastName || ''));
  }, [user]);

  // Already onboarded on arrival (e.g. landed here directly via URL) --
  // nothing to do, send them where they were actually headed. Gated to
  // the 'name' step specifically: onboarding_completed_at flips true the
  // moment step 2 creates a store, and without this guard that would
  // immediately fire too, skipping the optional-steps screen entirely
  // for every vendor who just went through the wizard for real.
  useEffect(() => {
    if (!loading && step === 'name' && user?.onboardingCompletedAt) {
      router.push('/dashboard/overview');
    }
  }, [loading, step, user, router]);

  if (loading || !isAuthenticated || !user || (step === 'name' && user.onboardingCompletedAt)) {
    return null;
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('First and last name are required');
      return;
    }
    setIsSavingName(true);
    setNameError("");
    try {
      const response = await secureApiCall('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ firstName, lastName })
      });
      if (response?.success) {
        await checkAuth();
        setStep('store');
      } else {
        setNameError(response?.message || 'Could not save -- try again');
      }
    } catch (error) {
      setNameError(error.message || 'Could not save -- try again');
    }
    setIsSavingName(false);
  };

  const handleStoreCreated = async () => {
    // Refresh the AuthContext user object -- POST /api/stores just set
    // onboarding_completed_at server-side, but the client's cached user
    // object doesn't know that yet, and DashboardLayout's redirect effect
    // reads it straight from context. Without this, navigating to
    // /dashboard/overview would immediately bounce back here.
    await checkAuth();
    setStep('optional');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10 sm:py-16">
      <img src="/stora.png" alt="Stora" className="w-12 h-12 object-contain mb-6" />

      <div className="w-full max-w-lg">
        {step === 'name' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
            <h1 className="text-lg font-semibold text-gray-900 mb-1.5">Confirm your legal name</h1>
            <p className="text-sm text-gray-500 mb-6">
              This should match your government ID -- it&apos;s what we&apos;ll check your identity
              verification against later, so getting it right now saves a failed attempt.
            </p>
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isSavingName}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isSavingName}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                />
              </div>
              {nameError && (
                <p className="text-red-500 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {nameError}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={isSavingName} className="w-full">
                {isSavingName ? 'Saving…' : 'Continue'}
              </Button>
            </form>
          </div>
        )}

        {step === 'store' && (
          <CreateStoreModal isOpen={true} onStoreCreated={handleStoreCreated} />
        )}

        {step === 'optional' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
            <h1 className="text-lg font-semibold text-gray-900 mb-1.5">You&apos;re in! A few optional things</h1>
            <p className="text-sm text-gray-500 mb-6">
              Your store is live. These aren&apos;t required to sell -- do them now or later from your dashboard.
            </p>
            <div className="space-y-3 mb-6">
              <OptionalStepCard
                icon={ShieldCheck}
                title="Get verified"
                description="Earn the “Verified by Stora” badge on your storefront"
                onClick={() => router.push('/dashboard/verification')}
              />
              <OptionalStepCard
                icon={Globe}
                title="Set up your website"
                description="Give buyers a link to your own branded storefront"
                onClick={() => router.push('/dashboard/website')}
              />
              <OptionalStepCard
                icon={MapPin}
                title="Delivery regions"
                description="You ship nationwide by default -- restrict this if you'd rather not"
                onClick={() => router.push('/dashboard/store')}
              />
            </div>
            <Button
              variant="primary"
              onClick={() => router.push('/dashboard/overview')}
              className="w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Go to dashboard
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionalStepCard({ icon: Icon, title, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 p-4 rounded-xl border border-gray-200 hover:border-brand-800 hover:bg-brand-50/50 transition-colors text-left"
    >
      <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-100 text-brand-800 shrink-0">
        <Icon className="w-4.5 h-4.5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
      </span>
      <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
    </button>
  );
}
