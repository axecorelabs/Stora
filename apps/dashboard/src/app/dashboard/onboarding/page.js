"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, UtensilsCrossed, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWebsiteData } from "@/hooks/useWebsiteData";
import { useVerificationEnabled } from "@/hooks/useVerificationEnabled";
import CreateStoreModal from "@/components/dashboard/CreateStoreModal";
import StoreBrandingModal from "@/components/dashboard/StoreBrandingModal";
import VerificationForm from "@/components/dashboard/VerificationForm";
import Button from "@/components/ui/Button";

const GOOGLE_FALLBACK_NAMES = new Set(['Google', 'User']);

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
  // storeQuery on /dashboard/overview -- since CreateStoreModal creates the
  // store via a plain fetch call (not a react-query mutation), nothing
  // invalidates it, and landing on Overview right after onboarding would
  // read the stale "no store" cache and show "Create Your Store" again.
  // handleStoreCreated below invalidates it explicitly once a store exists.
  // The website URL preview further down instead uses the store object
  // CreateStoreModal already hands back on success, sidestepping the same
  // staleness for its own display.
  const { toggleWebsite, isTogglingWebsite } = useWebsiteData();
  const verificationEnabled = useVerificationEnabled();
  const [createdStore, setCreatedStore] = useState(null);

  // Steps: 'name' -> 'store' -> 'branding' -> 'restaurant' -> 'verification'
  // -> 'website' -> 'done'. Always starts at 'name' -- there's no persisted
  // "step 1 done" flag, so re-entering the wizard (e.g. a refresh mid-flow)
  // just re-shows a pre-filled, one-click confirm rather than needing its
  // own progress column. Every step from 'branding' on is skippable (that's
  // unchanged), but they're real inline steps here, not links out to a page
  // that leaves the vendor to figure out the rest alone -- and nothing here
  // calls them "optional": they're skippable, not unimportant.
  const [step, setStep] = useState('name');

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [websiteError, setWebsiteError] = useState(null);
  const [isUpdatingRestaurantMode, setIsUpdatingRestaurantMode] = useState(false);
  const [restaurantModeError, setRestaurantModeError] = useState(null);

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
        setStep('store');
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

  const handleBrandingUpdated = (updatedStore) => {
    setCreatedStore((prev) => ({ ...prev, branding: updatedStore.branding }));
    setStep('restaurant');
  };

  const handleRestaurantModeChange = async (restaurantMode) => {
    if (isUpdatingRestaurantMode) return;
    setIsUpdatingRestaurantMode(true);
    setRestaurantModeError(null);
    try {
      const response = await secureApiCall('/api/stores/restaurant-mode', {
        method: 'PATCH',
        body: JSON.stringify({ restaurantMode })
      });
      if (!response?.success) {
        setRestaurantModeError(response?.message || 'Could not save -- try again');
        return;
      }
      setCreatedStore((prev) => ({ ...prev, restaurantMode: response.data.restaurantMode }));
      // DashboardHeader's badge and the inventory page's "Add Menu Item"
      // button both read restaurantMode from this same shared ['store']
      // query (see handleStoreCreated's own comment above) -- without
      // this, they'd keep showing the pre-toggle mode for up to that
      // query's 5-minute staleTime right after finishing onboarding.
      queryClient.invalidateQueries({ queryKey: ['store'] });
      // Skip straight past the verification step while QoreID's keys aren't
      // configured yet (see useVerificationEnabled) -- there's nothing to
      // show that wouldn't just fail if submitted.
      setStep(verificationEnabled === true ? 'verification' : 'website');
    } catch (error) {
      // Previously a bare try/finally: any thrown error (a 401 before the
      // session cookie settles, a network blip, a 500) was swallowed
      // silently and the wizard advanced anyway, leaving restaurant_mode
      // at its DB default of false regardless of what the vendor picked,
      // with no error shown and no way to retry from this step.
      setRestaurantModeError(error.message || 'Could not save -- try again');
    } finally {
      setIsUpdatingRestaurantMode(false);
    }
  };

  const handleTurnOnWebsite = async () => {
    setWebsiteError(null);
    try {
      await toggleWebsite('active');
      setStep('done');
    } catch (error) {
      setWebsiteError(error.message || 'Could not turn on your website -- try again');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10 sm:py-16">
      <img src="/stora.png" alt="Stora" className="w-12 h-12 object-contain mb-6" />

      <div className={`w-full ${step === 'store' ? 'max-w-2xl' : step === 'branding' ? 'max-w-3xl' : 'max-w-lg'}`}>
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
          <CreateStoreModal isOpen={true} onStoreCreated={handleStoreCreated} embedded />
        )}

        {step === 'branding' && (
          <StoreBrandingModal
            isOpen={true}
            embedded
            store={createdStore}
            onClose={() => setStep('restaurant')}
            onBrandingUpdated={handleBrandingUpdated}
          />
        )}

        {step === 'restaurant' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 text-center">
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed className="w-7 h-7 text-brand-800" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1.5">Do you sell food?</h1>
            <p className="text-sm text-gray-500 mb-6">
              Restaurant Mode switches on a menu-first item form and a menu-style layout for
              shoppers -- extras, made-to-order items, the works. It doesn&apos;t restrict what
              else you can sell.
            </p>
            {restaurantModeError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{restaurantModeError}</p>
              </div>
            )}
            <Button
              variant="primary"
              onClick={() => handleRestaurantModeChange(true)}
              disabled={isUpdatingRestaurantMode}
              className="w-full mb-3"
            >
              {isUpdatingRestaurantMode ? 'Turning on…' : 'Yes, turn on Restaurant Mode'}
            </Button>
            {/* Previously a bare-text <button> styled identically to the
                description paragraph above it (text-sm text-gray-500,
                no border/background) -- read as a caption, not a second
                choice, which is why this looked like a single-button
                screen. A real secondary button gives "No" the same
                visual weight as "Yes" for what is a genuine either/or
                decision, not a "skip for later" throwaway. */}
            <Button
              variant="secondary"
              onClick={() => handleRestaurantModeChange(false)}
              disabled={isUpdatingRestaurantMode}
              className="w-full"
            >
              No, I don&apos;t sell food
            </Button>
            <p className="text-xs text-gray-400 mt-3">You can change this anytime from Store settings.</p>
          </div>
        )}

        {step === 'verification' && (
          <div>
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
              onClick={() => setStep('done')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Skip for now -- you can do this anytime from Website
            </button>
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
