"use client";
import { useState, useEffect } from "react";
import { X, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CustomDropdown from "@/components/ui/CustomDropdown";

function PayoutSettingsForm({ onClose, onPayoutUpdated, store }) {
  const { secureApiCall } = useAuth();

  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [bankCode, setBankCode] = useState(store?.bankDetails?.bank_code || "");
  const [accountNumber, setAccountNumber] = useState(store?.bankDetails?.account_number || "");
  const [resolvedName, setResolvedName] = useState(store?.bankDetails?.account_name || "");
  const [isResolving, setIsResolving] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const alreadyConfigured = Boolean(store?.bankDetails?.paystack_subaccount_code);

  useEffect(() => {
    secureApiCall('/api/stores/payouts/banks')
      .then(response => {
        if (response.success) setBanks(response.banks);
      })
      .finally(() => setBanksLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bankOptions = banks.map(b => ({ value: b.code, label: b.name }));

  const handleResolve = async () => {
    if (!bankCode || accountNumber.length < 10) return;

    setIsResolving(true);
    setResolvedName("");
    setErrors(prev => ({ ...prev, resolve: "" }));

    try {
      const response = await secureApiCall(
        `/api/stores/payouts/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
      );
      if (response.success && response.accountName) {
        setResolvedName(response.accountName);
      } else {
        setErrors(prev => ({ ...prev, resolve: response.message || "Could not verify this account" }));
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, resolve: "Could not verify this account" }));
    } finally {
      setIsResolving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!bankCode || !accountNumber || !resolvedName) {
      setErrors({ submit: "Select a bank and verify the account number first" });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const bankName = banks.find(b => b.code === bankCode)?.name;
      const response = await secureApiCall('/api/stores/payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode, bankName, accountNumber })
      });

      if (response.success) {
        onPayoutUpdated(response.data);
        onClose();
      } else {
        setErrors({ submit: response.message || "Failed to save payout settings" });
      }
    } catch (error) {
      setErrors({ submit: error.message || "Failed to save payout settings" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Payout Settings</h2>
          <p className="text-sm text-gray-600 mt-1">
            {alreadyConfigured
              ? "Update where your online sales get paid out"
              : "Set up your bank account to accept online payments"}
          </p>
        </div>
        <button onClick={onClose} disabled={isSubmitting} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-600 text-sm">{errors.submit}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
          <CustomDropdown
            options={bankOptions}
            value={bankCode}
            onChange={(value) => { setBankCode(value); setResolvedName(""); }}
            placeholder={banksLoading ? "Loading banks..." : "Select your bank"}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account number</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10)); setResolvedName(""); }}
            onBlur={handleResolve}
            placeholder="0123456789"
            maxLength={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm text-gray-900"
          />
          {errors.resolve && <p className="text-red-500 text-xs mt-1">{errors.resolve}</p>}
        </div>

        {isResolving && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            Verifying account...
          </div>
        )}

        {resolvedName && !isResolving && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800">
              Account belongs to <span className="font-semibold">{resolvedName}</span>
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Online orders settle to this account roughly 24 hours after payment. Double-check the name above matches your business before saving.
        </p>

        <button
          type="submit"
          disabled={isSubmitting || !resolvedName}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isSubmitting ? "Saving..." : "Save payout settings"}
        </button>
      </form>
    </div>
  );
}

export default function PayoutSettingsModal({ isOpen, onClose, onPayoutUpdated, store }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {/* Keying by isOpen forces a fresh mount each time the modal opens,
          so form state (bank/account number/resolved name) naturally
          resets from `store` without needing an effect to sync it. */}
      <PayoutSettingsForm key={isOpen} onClose={onClose} onPayoutUpdated={onPayoutUpdated} store={store} />
    </div>
  );
}
