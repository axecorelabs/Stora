"use client";
import { useState } from "react";
import { X, Flag, CheckCircle, AlertCircle } from "lucide-react";
import TurnstileWidget, { TURNSTILE_ENABLED } from "@/components/ui/TurnstileWidget";

const RELATIONSHIP_OPTIONS = [
  { value: "owner", label: "I own this business" },
  { value: "employee", label: "I work here" },
  { value: "other", label: "Other" }
];

// Public dispute intake for a claimed listing -- the safety net for the
// dashboard's unverified self-attach claim path (see the Part H plan).
// Chrome mirrors apps/store/src/components/orders/WhatsAppContactModal.js;
// field/Turnstile/submit-state pattern mirrors
// apps/store/src/components/business/SuggestBusinessForm.js.
export default function ReportListingModal({ isOpen, onClose, storeId }) {
  const [form, setForm] = useState({ reporterName: "", reporterEmail: "", reporterPhone: "", relationship: "owner", details: "" });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.reporterName.trim() || !form.reporterEmail.trim() || !form.details.trim()) {
      setError("Your name, email, and details are required");
      return;
    }
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError("Please complete the verification check");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/listings/${storeId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken })
      });
      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || "Failed to submit report");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(8, 42, 32, 0.55)' }}>
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90dvh] overflow-hidden shadow-2xl flex flex-col">
        <div className="text-center p-6 border-b border-gray-100 relative flex-shrink-0 bg-brand-50/70">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-brand-100">
            <Flag className="w-7 h-7 text-brand-700" />
          </div>
          <h3 className="font-display text-xl font-semibold text-brand-900 mb-1.5">Report this listing</h3>
          <p className="text-brand-800/60 text-sm">Let us know if something&apos;s wrong with who manages this business</p>
        </div>

        <div className="overflow-y-auto p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Report received</h4>
              <p className="text-gray-600 text-sm">Our team will look into it.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name *</label>
                <input
                  type="text"
                  value={form.reporterName}
                  onChange={(e) => handleChange("reporterName", e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm text-gray-900 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your email *</label>
                <input
                  type="email"
                  value={form.reporterEmail}
                  onChange={(e) => handleChange("reporterEmail", e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm text-gray-900 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your phone (optional)</label>
                <input
                  type="tel"
                  value={form.reporterPhone}
                  onChange={(e) => handleChange("reporterPhone", e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm text-gray-900 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your relationship to this business</label>
                <select
                  value={form.relationship}
                  onChange={(e) => handleChange("relationship", e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm text-gray-900 disabled:opacity-50"
                >
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What&apos;s wrong? *</label>
                <textarea
                  value={form.details}
                  onChange={(e) => handleChange("details", e.target.value)}
                  placeholder="e.g. This is my business and I didn't claim it -- someone else did"
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm text-gray-900 disabled:opacity-50 resize-y"
                />
              </div>

              <TurnstileWidget
                onVerify={(token) => { setTurnstileToken(token); setTurnstileError(false); }}
                onError={() => { setTurnstileToken(""); setTurnstileError(true); }}
              />
              {turnstileError && (
                <p className="text-red-500 text-xs -mt-2">Verification failed — refresh the page and try again.</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-800 hover:bg-brand-900 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit report"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
