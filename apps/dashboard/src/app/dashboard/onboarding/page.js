"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, CheckCircle2, AlertCircle, Store, LayoutList, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWebsiteData } from "@/hooks/useWebsiteData";
import { useVerificationEnabled } from "@/hooks/useVerificationEnabled";
import { useTelegramEnabled } from "@/hooks/useTelegramEnabled";
import CreateBusinessModal from "@/components/dashboard/CreateBusinessModal";
import ClaimBusinessStep from "@/components/dashboard/ClaimBusinessStep";
import FindBusinessStep from "@/components/dashboard/FindBusinessStep";
import StoreBrandingModal from "@/components/dashboard/StoreBrandingModal";
import VerificationForm from "@/components/dashboard/VerificationForm";
import TelegramForm from "@/components/dashboard/TelegramForm";
import Button from "@/components/ui/Button";

const GOOGLE_FALLBACK_NAMES = new Set(['Google', 'User']);
const ONBOARDING_INTENT_KEY = 'stora-onboarding-intent';
const ONBOARDING_CLAIM_STORE_ID_KEY = 'stora-onboarding-claim-store-id';

// Own minimal shell, not wrapped in DashboardLayout -- both because this
// is a distinct first-run experience (no sidebar/nav clutter) and to
// avoid a redirect loop with DashboardLayout's own
// "onboarding incomplete -> push here" effect.
export default function OnboardingPage() {
  const { user, loading, isAuthenticated, secureApiCall, checkAuth } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  // This hook's own `['store']` query fetches on mount (during the 'name'
  // step, before any store exists yet) and caches a "no store" result for
  // its 5-minute staleTime. That key is shared with useDashboardData's own
  // storeQuery on /dashboard/overview -- since CreateBusinessModal creates
  // the store via a plain fetch call (not a react-query mutation), nothing
  // invalidates it, and landing on Overview right after onboarding would
  // read the stale "no store" cache and show "Create Your Business" again.
  // handleStoreCreated below invalidates it explicitly once a store exists.
  // The website URL preview further down instead uses the store object
  // CreateBusinessModal already hands back on success, sidestepping the same
  // staleness for its own display.
  const { toggleWebsite, isTogglingWebsite } = useWebsiteData();
  const verificationEnabled = useVerificationEnabled();
  const telegramEnabled = useTelegramEnabled();
  const [createdStore, setCreatedStore] = useState(null);

  // Steps:
  //   store track:   name -> intent -> business -> branding -> verification -> website -> telegram -> done
  //   listing track: name -> intent -> business -> branding -> subscribe -> done
  //
  // 'intent' is the new "What do you want to do?" screen. It sets platformIntent
  // ('store' | 'listing') which is passed to CreateBusinessModal so POST /api/stores
  // sets platform_mode correctly. Listing accounts skip website/telegram and land
  // on 'subscribe' instead -- the listing only goes live once Paystack confirms payment.
  const [step, setStep] = useState('name');
  // 'store' | 'listing' -- chosen at the 'intent' step, carried through to
  // store creation. Defaults to 'listing' to match the intent step now
  // leading with "List My Business" -- irrelevant to any real flow (a user
  // always explicitly picks one), but keeps this value consistent with
  // what's visually presented first if it's ever read before that pick.
  const [platformIntent, setPlatformIntent] = useState('listing');

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [websiteError, setWebsiteError] = useState(null);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [isStartingSubscription, setIsStartingSubscription] = useState(false);
  const [preferredIntent, setPreferredIntent] = useState(null);
  // Only set when preferredIntent === 'claim' -- the store being claimed,
  // carried across the signup/verification redirect the same way `intent`
  // itself is (see apps/dashboard/src/app/page.js's bridge).
  const [claimStoreId, setClaimStoreId] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const query = new URLSearchParams(window.location.search);
    const fromQuery = query.get('intent');
    if (fromQuery === 'store' || fromQuery === 'listing') {
      setPreferredIntent(fromQuery);
      setPlatformIntent(fromQuery);
      return;
    }
    if (fromQuery === 'claim') {
      const storeId = query.get('storeId');
      if (storeId) {
        setPreferredIntent('claim');
        setClaimStoreId(storeId);
        return;
      }
    }

    const fromStorage = localStorage.getItem(ONBOARDING_INTENT_KEY);
    if (fromStorage === 'store' || fromStorage === 'listing') {
      // One-time use: avoid stale forced routing on future onboarding visits.
      localStorage.removeItem(ONBOARDING_INTENT_KEY);
      setPreferredIntent(fromStorage);
      setPlatformIntent(fromStorage);
    } else if (fromStorage === 'claim') {
      const storeId = localStorage.getItem(ONBOARDING_CLAIM_STORE_ID_KEY);
      if (storeId) {
        localStorage.removeItem(ONBOARDING_INTENT_KEY);
        localStorage.removeItem(ONBOARDING_CLAIM_STORE_ID_KEY);
        setPreferredIntent('claim');
        setClaimStoreId(storeId);
      }
    }
  }, []);

  const handleChangeSetupType = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ONBOARDING_INTENT_KEY);
    }
    setPreferredIntent(null);
    setStep('intent');
    router.replace('/dashboard/onboarding');
  };

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
  // moment the store step creates a store, and without this guard that
  // would immediately fire too, skipping every step after it for every
  // vendor who just went through the wizard for real.
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
        setStep(preferredIntent === 'claim' ? 'claim' : preferredIntent ? 'business' : 'intent');
      } else {
        setNameError(response?.message || 'Could not save -- try again');
      }
    } catch (error) {
      setNameError(error.message || 'Could not save -- try again');
    }
    setIsSavingName(false);
  };

  const handleStoreCreated = async (store) => {
    setCreatedStore(store);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ONBOARDING_INTENT_KEY);
    }
    // Refresh the AuthContext user object -- POST /api/stores just set
    // onboarding_completed_at server-side, but the client's cached user
    // object doesn't know that yet, and DashboardLayout's redirect effect
    // reads it straight from context. Without this, navigating away
    // later would immediately bounce back here.
    await checkAuth();
    // See this file's top comment: the store now exists, so the stale
    // pre-creation "no store" result cached under this same key (by this
    // page's own useWebsiteData call, and possibly other dashboard pages
    // visited earlier in the session) must not be left for Overview to
    // read once this wizard finishes.
    queryClient.invalidateQueries({ queryKey: ['store'] });
    setStep('branding');
  };

  // Same shape/purpose as handleStoreCreated above, for the claim track --
  // the difference is platformIntent comes from the CLAIMED store's own
  // platform_mode (already decided by whoever originally listed it),
  // not a choice this visitor makes, since there's no 'intent' step here.
  const handleClaimed = async (store) => {
    setCreatedStore(store);
    setPlatformIntent(store.platformMode === 'store' ? 'store' : 'listing');
    await checkAuth();
    queryClient.invalidateQueries({ queryKey: ['store'] });
    setStep('branding');
  };

  const handleBrandingUpdated = (updatedStore) => {
    setCreatedStore((prev) => ({ ...prev, branding: updatedStore.branding }));
    if (platformIntent === 'listing') {
      // Listing track: skip website/telegram, go straight to subscription payment.
      setStep('subscribe');
      return;
    }
    // Skip straight past the verification step while QoreID's keys aren't
    // configured yet (see useVerificationEnabled) -- there's nothing to
    // show that wouldn't just fail if submitted. Previously this went to a
    // standalone 'restaurant' step first (see this file's top comment).
    setStep(verificationEnabled === true ? 'verification' : 'website');
  };

  // Same conditional-skip shape verification/branding already use --
  // there's no Telegram step to show at all while the bot isn't
  // configured (see useTelegramEnabled).
  const goToTelegramOrDone = () => setStep(telegramEnabled === true ? 'telegram' : 'done');

  const handleTurnOnWebsite = async () => {
    setWebsiteError(null);
    try {
      await toggleWebsite('active');
      goToTelegramOrDone();
    } catch (error) {
      setWebsiteError(error.message || 'Could not turn on your website -- try again');
    }
  };

  const handleStartListingSubscription = async () => {
    if (isStartingSubscription) return;
    setSubscriptionError('');
    setIsStartingSubscription(true);
    try {
      const response = await secureApiCall('/api/subscription', { method: 'POST' });
      if (response?.authorizationUrl) {
        window.location.href = response.authorizationUrl;
        return;
      }
      setSubscriptionError(response?.message || 'Could not start payment -- try again.');
    } catch (error) {
      setSubscriptionError(error?.message || 'Could not start payment -- try again.');
    } finally {
      setIsStartingSubscription(false);
    }
  };

  // Whole-flow progress, not just CreateBusinessModal's own internal
  // Basics/Location sub-steps -- a vendor on a slow connection has no idea
  // how many screens are left otherwise. The two tracks diverge after
  // 'branding'; verification/telegram only appear when their feature flags
  // are on (see useVerificationEnabled/useTelegramEnabled above), so the
  // "planned" list has to account for that or the count would be wrong for
  // however many vendors don't see those steps.
  const businessStepName = preferredIntent === 'claim' ? 'claim' : 'business';
  const storeTrackSteps = [
    'name', 'intent', 'find-business', businessStepName, 'branding',
    ...(verificationEnabled === true ? ['verification'] : []),
    'website',
    ...(telegramEnabled === true ? ['telegram'] : []),
    'done'
  ];
  const listingTrackSteps = ['name', 'intent', 'find-business', businessStepName, 'branding', 'subscribe', 'done'];
  const activeTrackSteps = platformIntent === 'listing' ? listingTrackSteps : storeTrackSteps;
  const stepIndex = activeTrackSteps.indexOf(step);
  const showProgress = step !== 'done' && stepIndex > -1;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10 sm:py-16">
      <img src="/stora.png" alt="Stora" className="w-12 h-12 object-contain mb-6" />

      <div className={`w-full ${step === 'business' ? 'max-w-2xl' : step === 'branding' ? 'max-w-3xl' : 'max-w-lg'}`}>
        {showProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">
                Step {stepIndex + 1} of {activeTrackSteps.length - 1}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-brand-800 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(stepIndex / (activeTrackSteps.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

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

        {step === 'intent' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
            <h1 className="text-lg font-semibold text-gray-900 mb-1.5">What do you want to do?</h1>
            <p className="text-sm text-gray-500 mb-6">
              You can always upgrade later -- this just gets your setup pointed in the right direction.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setPlatformIntent('listing'); setStep('find-business'); }}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-brand-800 hover:bg-brand-50 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-200 transition-colors">
                    <LayoutList className="w-5 h-5 text-brand-800" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">List My Business</p>
                    <p className="text-xs text-gray-500 mt-0.5">Create a business profile so customers can find you, view your services, and contact you.</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setPlatformIntent('store'); setStep('find-business'); }}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-brand-800 hover:bg-brand-50 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-200 transition-colors">
                    <Store className="w-5 h-5 text-brand-800" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Sell on Stora</p>
                    <p className="text-xs text-gray-500 mt-0.5">Set up a store, list products or services, and accept orders online.</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'find-business' && (
          <FindBusinessStep
            onFound={(storeId) => { setClaimStoreId(storeId); setPreferredIntent('claim'); setStep('claim'); }}
            onSkip={() => setStep('business')}
            onBack={() => setStep('intent')}
          />
        )}

        {step === 'business' && (
          <div>
            {/* Safe to always offer here -- nothing has been created yet,
                unlike the steps after 'branding' where the store already
                exists and a plain step-back can't undo that. 'find-business'
                is always the step immediately before this one in the
                organic flow now, so a plain "Back" returns there; only a
                pre-set preferredIntent (external ?intent=store|listing
                link, which skips both 'intent' and 'find-business'
                entirely) still resets all the way via handleChangeSetupType. */}
            <button
              onClick={preferredIntent ? handleChangeSetupType : () => setStep('find-business')}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:text-brand-700"
            >
              <ArrowLeft className="w-4 h-4" />
              {preferredIntent ? 'Change setup type' : 'Back'}
            </button>
            <CreateBusinessModal isOpen={true} onStoreCreated={handleStoreCreated} embedded platformMode={platformIntent} />
          </div>
        )}

        {step === 'claim' && claimStoreId && (
          <ClaimBusinessStep storeId={claimStoreId} onClaimed={handleClaimed} />
        )}

        {step === 'branding' && (
          <StoreBrandingModal
            isOpen={true}
            embedded
            store={createdStore}
            onClose={() => {
              if (platformIntent === 'listing') {
                setStep('subscribe');
              } else {
                setStep(verificationEnabled === true ? 'verification' : 'website');
              }
            }}
            onBrandingUpdated={handleBrandingUpdated}
          />
        )}

        {step === 'verification' && (
          <div>
            {/* Safe to go back to -- branding only PATCHes the already-created
                store, it never re-creates it, unlike a step-back into
                CreateBusinessModal would. */}
            <button
              onClick={() => setStep('branding')}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:text-brand-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <VerificationForm onVerified={() => setStep('website')} />
            <button
              onClick={() => setStep('website')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-4"
            >
              Skip for now -- you can do this anytime from Settings
            </button>
          </div>
        )}

        {step === 'website' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 text-center">
            <button
              onClick={() => setStep(verificationEnabled === true ? 'verification' : 'branding')}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:text-brand-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <Globe className="w-7 h-7 text-brand-800" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1.5">Turn on your website</h1>
            <p className="text-sm text-gray-500 mb-1">
              Buyers can only find and order from you online once this is on -- you can customize
              branding and settings anytime after.
            </p>
            {createdStore?.websiteFullPath && (
              <p className="text-sm font-medium text-brand-800 mb-6">{createdStore.websiteFullPath}</p>
            )}
            {websiteError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{websiteError}</p>
              </div>
            )}
            <Button
              variant="primary"
              onClick={handleTurnOnWebsite}
              disabled={isTogglingWebsite}
              className="w-full mb-3"
            >
              {isTogglingWebsite ? 'Turning on…' : 'Turn on my website'}
            </Button>
            <button
              onClick={goToTelegramOrDone}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Skip for now -- you can do this anytime from Website
            </button>
          </div>
        )}

        {step === 'telegram' && (
          <div>
            <button
              onClick={() => setStep('website')}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:text-brand-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <TelegramForm onConnected={() => setStep('done')} />
            <button
              onClick={() => setStep('done')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-4"
            >
              Skip for now -- you can do this anytime from Settings
            </button>
          </div>
        )}

        {step === 'subscribe' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 text-center">
            <button
              onClick={() => setStep('branding')}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:text-brand-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <LayoutList className="w-7 h-7 text-brand-800" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1.5">Activate your listing</h1>
            <p className="text-sm text-gray-500 mb-2">
              Your showcase page is ready. Subscribe to make it live.
            </p>
            <p className="text-2xl font-bold text-gray-900 mb-1">₦500<span className="text-sm font-normal text-gray-500">/month</span></p>
            <p className="text-xs text-gray-500 mb-6">Cancel anytime from your dashboard.</p>
            {subscriptionError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{subscriptionError}</p>
              </div>
            )}
            <Button
              variant="primary"
              onClick={handleStartListingSubscription}
              disabled={isStartingSubscription}
              className="w-full mb-3"
            >
              {isStartingSubscription ? 'Redirecting to payment…' : 'Subscribe and go live'}
            </Button>
            <button
              onClick={() => router.push('/dashboard/overview')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Do this later from dashboard
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Your business profile is saved either way -- it just won&apos;t be visible to customers until you subscribe.
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 text-center">
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-brand-800" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1.5">You&apos;re all set</h1>
            <p className="text-sm text-gray-500 mb-6">
              Your store is live. You deliver nationwide by default -- restrict this anytime from
              Store settings if you&apos;d rather not.
            </p>
            <Button
              variant="primary"
              onClick={() => router.push('/dashboard/overview')}
              className="w-full"
            >
              Go to dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
