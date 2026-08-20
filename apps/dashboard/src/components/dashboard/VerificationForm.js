"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, AlertCircle, CheckCircle2, Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";

const NIN_REGEX = /^\d{11}$/;

// Reads a File into a bare base64 string (no `data:image/...;base64,`
// prefix) -- QoreID's photoBase64 field wants the raw value, and this is
// the only place the selfie ever touches this page's state; it's sent
// straight to our own API and never written anywhere else.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Shared by the standalone /dashboard/verification page and the
// onboarding wizard's inline verification step -- same form, same
// submit behavior, either embedded directly (wizard) or wrapped in
// DashboardLayout (standalone page). `onVerified` fires only once a
// submission actually resolves to `status === 'verified'`, not merely
// "the request succeeded" (a request can succeed and still come back
// failed -- see the POST /api/stores/verification response shape).
export default function VerificationForm({ onVerified }) {
  const { secureApiCall } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // { isVerified, verificationStatus, lastAttempt }
  const [nin, setNin] = useState("");
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    const response = await secureApiCall('/api/stores/verification');
    if (response?.success) {
      setStatus(response.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelfieChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
    if (errors.selfie) setErrors((prev) => ({ ...prev, selfie: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!NIN_REGEX.test(nin)) newErrors.nin = 'Enter your 11-digit NIN';
    if (!selfieFile) newErrors.selfie = 'A selfie photo is required';
    if (!consentGiven) newErrors.consent = 'You must consent to continue';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const photoBase64 = await fileToBase64(selfieFile);
      const response = await secureApiCall('/api/stores/verification', {
        method: 'POST',
        body: JSON.stringify({ idNumber: nin, photoBase64, consentGiven })
      });

      if (response?.success) {
        setNin("");
        setSelfieFile(null);
        setSelfiePreview(null);
        setConsentGiven(false);
        await fetchStatus();
        if (response.data?.status === 'verified') {
          onVerified?.();
        }
      } else {
        setSubmitError(response?.message || 'Verification failed -- try again');
      }
    } catch (error) {
      setSubmitError(error.message || 'Verification failed -- try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerified = status?.isVerified;
  const isPending = status?.lastAttempt?.status === 'pending';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-800" />
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-brand-800" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">You&apos;re verified</h2>
        <p className="text-sm text-gray-500">
          Buyers see the &ldquo;Verified by Stora&rdquo; badge on your storefront.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center gap-3 mb-2">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-100 text-brand-800 shrink-0">
          <ShieldCheck className="w-4.5 h-4.5" />
        </span>
        <h2 className="text-lg font-semibold text-gray-900">Verify your identity</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        We use QoreID to confirm your National Identity Number (NIN) and match it against a
        selfie -- this earns your store the &ldquo;Verified by Stora&rdquo; badge buyers see and
        use to decide who to trust.
      </p>

      {status?.lastAttempt?.status === 'failed' && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            Last attempt didn&apos;t succeed{status.lastAttempt.failureReason ? `: ${status.lastAttempt.failureReason}` : '.'} You can try again below.
          </p>
        </div>
      )}

      {isPending ? (
        <div className="rounded-lg bg-gold-400/10 border border-gold-500/25 px-3 py-2.5 text-sm text-gold-700">
          A verification attempt is in progress. Check back shortly.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">National Identity Number (NIN)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={nin}
              onChange={(e) => { setNin(e.target.value.replace(/\D/g, '')); if (errors.nin) setErrors((p) => ({ ...p, nin: '' })); }}
              placeholder="11-digit NIN"
              disabled={isSubmitting}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${errors.nin ? 'border-red-300' : 'border-gray-300'}`}
            />
            {errors.nin && <p className="text-red-500 text-xs mt-1">{errors.nin}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Selfie</label>
            <p className="text-xs text-gray-500 mb-2">Take a clear photo of your face -- used only to confirm it matches your NIN, never stored.</p>
            <label className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer hover:bg-gray-50 ${errors.selfie ? 'border-red-300' : 'border-gray-300'}`}>
              {selfiePreview ? (
                <img src={selfiePreview} alt="Selfie preview" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <Camera className="w-5 h-5 text-gray-400" />
              )}
              <span className="text-sm text-gray-700">{selfieFile ? selfieFile.name : 'Take or choose a photo'}</span>
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleSelfieChange}
                disabled={isSubmitting}
                className="hidden"
              />
            </label>
            {errors.selfie && <p className="text-red-500 text-xs mt-1">{errors.selfie}</p>}
          </div>

          <div>
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => { setConsentGiven(e.target.checked); if (errors.consent) setErrors((p) => ({ ...p, consent: '' })); }}
                disabled={isSubmitting}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-700">
                I consent to Stora sharing my NIN and selfie with QoreID, our identity verification
                provider, solely to confirm my identity. My NIN is not stored by Stora.
              </span>
            </label>
            {errors.consent && <p className="text-red-500 text-xs mt-1">{errors.consent}</p>}
          </div>

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Verifying…' : (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Verify my identity
              </span>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
