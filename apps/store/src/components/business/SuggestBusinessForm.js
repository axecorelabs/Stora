"use client";
import { useState } from "react";
import { CheckCircle, AlertCircle, Building2 } from "lucide-react";
import TurnstileWidget, { TURNSTILE_ENABLED } from "@/components/ui/TurnstileWidget";

export default function SuggestBusinessForm() {
  const [form, setForm] = useState({
    suggestedName: "",
    suggestedCategoryText: "",
    suggestedLocationText: "",
    submitterContact: "",
    notes: ""
  });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.suggestedName.trim()) {
      setError("Business name is required");
      return;
    }

    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError("Please complete the verification check");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/business-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken })
      });
      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || "Failed to submit suggestion");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-brand-700" />
            </div>
            <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Suggest a Business</h1>
            <p className="text-gray-600">Know a business that should be on Stora? Tell us about it.</p>
          </div>

          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Thanks for the tip!</h3>
              <p className="text-gray-600">Our team will take a look and reach out to the business.</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input
                  type="text"
                  value={form.suggestedName}
                  onChange={(e) => handleChange("suggestedName", e.target.value)}
                  placeholder="Bella's Cakes"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm text-gray-900 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What do they sell/do? (Optional)</label>
                <input
                  type="text"
                  value={form.suggestedCategoryText}
                  onChange={(e) => handleChange("suggestedCategoryText", e.target.value)}
                  placeholder="Cakes & desserts"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm text-gray-900 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Where are they based? (Optional)</label>
                <input
                  type="text"
                  value={form.suggestedLocationText}
                  onChange={(e) => handleChange("suggestedLocationText", e.target.value)}
                  placeholder="Osogbo, Osun"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm text-gray-900 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Contact (Optional)</label>
                <input
                  type="text"
                  value={form.submitterContact}
                  onChange={(e) => handleChange("submitterContact", e.target.value)}
                  placeholder="Phone or email, in case we have questions"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm text-gray-900 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anything else? (Optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Any other details that would help us find them"
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
                {isSubmitting ? "Submitting..." : "Submit Suggestion"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
