"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { BUSINESS_CATEGORY_VALUES } from "@stora/shared-constants";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";

const categoryLabel = (value) => value.charAt(0).toUpperCase() + value.slice(1);

// Renders in place of CreateBusinessModal on the onboarding wizard's
// 'business' step when the visitor arrived via a "claim this business"
// link (?intent=claim&storeId=...) rather than a fresh signup. Mirrors
// CreateBusinessModal's onStoreCreated contract: calling onClaimed(store)
// advances the wizard to 'branding' exactly the same way.
//
// Branches on the GET eligibility response's verificationMethod: a
// listing with a real store_email goes through email-OTP (send-code/
// verify); one with nothing to verify against goes through the unverified
// self-attach path (attach, then a short "review your info" form) --
// see the Part H plan for why these have very different trust bars.
export default function ClaimBusinessStep({ storeId, onClaimed }) {
  const { secureApiCall } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [business, setBusiness] = useState(null);

  const [codeSent, setCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [sendError, setSendError] = useState("");

  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const [isAttaching, setIsAttaching] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [attachedStore, setAttachedStore] = useState(null);

  const [editFields, setEditFields] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await secureApiCall(`/api/claims/${storeId}`);
        if (cancelled) return;
        if (response?.success) {
          setBusiness(response.data);
        } else {
          setLoadError(response?.message || "This business can't be claimed right now.");
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message || "This business can't be claimed right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, secureApiCall]);

  const handleSendCode = async () => {
    setIsSendingCode(true);
    setSendError("");
    try {
      const response = await secureApiCall(`/api/claims/${storeId}/send-code`, { method: "POST" });
      if (response?.success) {
        setCodeSent(true);
      } else {
        setSendError(response?.message || "Could not send the code -- try again");
      }
    } catch (error) {
      setSendError(error.message || "Could not send the code -- try again");
    }
    setIsSendingCode(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsVerifying(true);
    setVerifyError("");
    try {
      const response = await secureApiCall(`/api/claims/${storeId}/verify`, {
        method: "POST",
        body: JSON.stringify({ code: code.trim() })
      });
      if (response?.success) {
        onClaimed(response.data);
      } else {
        setVerifyError(response?.message || "Incorrect code -- try again");
      }
    } catch (error) {
      setVerifyError(error.message || "Incorrect code -- try again");
    }
    setIsVerifying(false);
  };

  const handleAttach = async () => {
    setIsAttaching(true);
    setAttachError("");
    try {
      const response = await secureApiCall(`/api/claims/${storeId}/attach`, { method: "POST" });
      if (response?.success) {
        const store = response.data;
        setAttachedStore(store);
        setEditFields({
          storeName: store.storeName || "",
          businessCategory: store.businessCategory || "other",
          storePhone: store.storePhone || "",
          storeEmail: store.storeEmail || "",
          addressStreet: store.address?.street || "",
          addressCity: store.address?.city || ""
        });
      } else {
        setAttachError(response?.message || "Could not claim this business -- try again");
      }
    } catch (error) {
      setAttachError(error.message || "Could not claim this business -- try again");
    }
    setIsAttaching(false);
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError("");
    try {
      const response = await secureApiCall("/api/stores", {
        method: "PUT",
        body: JSON.stringify({
          storeName: editFields.storeName,
          businessCategory: editFields.businessCategory,
          storePhone: editFields.storePhone || null,
          storeEmail: editFields.storeEmail || null,
          address: { ...attachedStore.address, street: editFields.addressStreet, city: editFields.addressCity }
        })
      });
      if (response?.success) {
        onClaimed(response.data);
      } else {
        setSaveError(response?.message || "Could not save -- try again");
      }
    } catch (error) {
      setSaveError(error.message || "Could not save -- try again");
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 text-center text-sm text-gray-500">
        Checking this listing…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1.5">Can&apos;t claim this listing</h1>
        <p className="text-sm text-gray-500">{loadError}</p>
      </div>
    );
  }

  // Attached (unverified path) -- review/correct info before continuing.
  if (attachedStore) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1.5">You&apos;re attached to this listing</h1>
        <p className="text-sm text-gray-500 mb-6">
          Check the details below and correct anything that&apos;s wrong or missing.
        </p>
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Business name</label>
            <input
              type="text"
              value={editFields.storeName}
              onChange={(e) => setEditFields((f) => ({ ...f, storeName: e.target.value }))}
              disabled={isSaving}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={editFields.businessCategory}
              onChange={(e) => setEditFields((f) => ({ ...f, businessCategory: e.target.value }))}
              disabled={isSaving}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            >
              {BUSINESS_CATEGORY_VALUES.map((value) => (
                <option key={value} value={value}>{categoryLabel(value)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={editFields.storePhone}
                onChange={(e) => setEditFields((f) => ({ ...f, storePhone: e.target.value }))}
                disabled={isSaving}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={editFields.storeEmail}
                onChange={(e) => setEditFields((f) => ({ ...f, storeEmail: e.target.value }))}
                disabled={isSaving}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Street address</label>
            <input
              type="text"
              value={editFields.addressStreet}
              onChange={(e) => setEditFields((f) => ({ ...f, addressStreet: e.target.value }))}
              disabled={isSaving}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
            <input
              type="text"
              value={editFields.addressCity}
              onChange={(e) => setEditFields((f) => ({ ...f, addressCity: e.target.value }))}
              disabled={isSaving}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
          </div>
          {saveError && (
            <p className="text-red-500 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {saveError}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={isSaving} className="w-full">
            {isSaving ? "Saving…" : "Save and continue"}
          </Button>
          <button
            type="button"
            onClick={() => onClaimed(attachedStore)}
            disabled={isSaving}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Skip for now -- you can do this anytime from Settings
          </button>
        </form>
      </div>
    );
  }

  // Unverified path -- nothing on file to verify against, so claiming is a
  // self-attestation rather than an OTP check.
  if (business.verificationMethod === 'unverified') {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mb-4">
          <Building2 className="w-7 h-7 text-brand-800" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1.5">Claim {business.storeName}</h1>
        <p className="text-sm text-gray-500 mb-6">
          We don&apos;t have contact info on file to verify against for this listing. You can still
          claim it -- you&apos;ll be attesting under your own Stora account that you operate this
          business.
        </p>
        {attachError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{attachError}</p>
          </div>
        )}
        <Button variant="primary" onClick={handleAttach} disabled={isAttaching} className="w-full">
          {isAttaching ? "Claiming…" : "Claim this business"}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
      <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mb-4">
        <Building2 className="w-7 h-7 text-brand-800" />
      </div>
      <h1 className="text-lg font-semibold text-gray-900 mb-1.5">Claim {business.storeName}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {business.state ? `${business.state} · ` : ""}We&apos;ll send a verification code to the email
        already listed for this business to confirm you&apos;re the owner.
      </p>

      {!codeSent ? (
        <>
          <p className="text-sm text-gray-700 mb-4">
            Send a code to <span className="font-medium">{business.maskedEmail}</span>
          </p>
          {sendError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{sendError}</p>
            </div>
          )}
          <Button variant="primary" onClick={handleSendCode} disabled={isSendingCode} className="w-full">
            {isSendingCode ? "Sending…" : "Send code"}
          </Button>
        </>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 flex items-start gap-2 text-left">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">Code sent to {business.maskedEmail}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isVerifying}
              placeholder="6-digit code"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black tracking-widest"
            />
          </div>
          {verifyError && (
            <p className="text-red-500 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {verifyError}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={isVerifying || !code.trim()} className="w-full">
            {isVerifying ? "Verifying…" : "Verify and claim"}
          </Button>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={isSendingCode}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            {isSendingCode ? "Resending…" : "Resend code"}
          </button>
        </form>
      )}
    </div>
  );
}
