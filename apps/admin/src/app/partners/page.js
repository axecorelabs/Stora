"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";

function formatRate(rateType, rateValue) {
  return rateType === "flat" ? `₦${Number(rateValue).toLocaleString()} flat` : `${(Number(rateValue) * 100).toFixed(0)}%`;
}

const STATUS_STYLES = {
  proposed: "bg-gold-500/15 text-gold-700",
  accepted: "bg-green-50 text-green-700",
  declined: "bg-red-50 text-red-600",
  terminated: "bg-gray-100 text-gray-500"
};

function ProposeContractModal({ store, onClose, onProposed }) {
  const { secureApiCall } = useAuth();
  const [rateType, setRateType] = useState("percentage");
  const [rateValue, setRateValue] = useState("");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const numericValue = rateType === "percentage" ? Number(rateValue) / 100 : Number(rateValue);
      const data = await secureApiCall(`/api/partners/${store.id}/contracts`, {
        method: "POST",
        body: JSON.stringify({ rateType, rateValue: numericValue, terms })
      });
      if (!data.success) {
        setError(data.message || "Failed to send proposal");
        return;
      }
      onProposed(data.contract);
    } catch (err) {
      console.error("Error proposing contract:", err);
      setError("Failed to send proposal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900">Propose a partnership</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">{store.storeName}</p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rate on campaign-driven sales</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setRateType("percentage")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${rateType === "percentage" ? "bg-brand-800 text-white border-brand-800" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
              >
                Percentage
              </button>
              <button
                type="button"
                onClick={() => setRateType("flat")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${rateType === "flat" ? "bg-brand-800 text-white border-brand-800" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
              >
                Flat fee
              </button>
            </div>
            <div className="relative">
              {rateType === "percentage" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              )}
              {rateType === "flat" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₦</span>
              )}
              <input
                type="number"
                min="0"
                step={rateType === "percentage" ? "1" : "50"}
                value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
                placeholder={rateType === "percentage" ? "e.g. 8" : "e.g. 500"}
                className={`w-full py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 ${rateType === "flat" ? "pl-7 pr-3" : "pl-3 pr-7"}`}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              The base 2% platform fee is always covered by the customer on these sales -- this rate comes out of the vendor&apos;s side.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Terms (shown to the vendor)</label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3}
              placeholder="Describe the campaign and what this partnership covers..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-300">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !rateValue || Number(rateValue) <= 0}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-900 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Send proposal
          </button>
        </div>
      </div>
    </div>
  );
}

function PartnersPageContent() {
  const { secureApiCall } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [proposingStore, setProposingStore] = useState(null);
  const [actingOn, setActingOn] = useState(null);

  const load = useCallback(async (q) => {
    setLoading(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const data = await secureApiCall(`/api/partners${params}`);
      if (data.success) setStores(data.stores);
    } catch (error) {
      console.error("Error loading vendors:", error);
    } finally {
      setLoading(false);
    }
  }, [secureApiCall]);

  useEffect(() => {
    const timeout = setTimeout(() => load(query), 300);
    return () => clearTimeout(timeout);
  }, [query, load]);

  const handleProposed = (storeId, contract) => {
    setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, contract } : s)));
    setProposingStore(null);
  };

  const handleWithdraw = async (store) => {
    setActingOn(store.id);
    try {
      const data = await secureApiCall(`/api/partners/${store.id}/contracts/${store.contract.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "declined" })
      });
      if (data.success) {
        setStores((prev) => prev.map((s) => (s.id === store.id ? { ...s, contract: { ...s.contract, status: "declined" } } : s)));
      }
    } catch (error) {
      console.error("Error withdrawing proposal:", error);
    } finally {
      setActingOn(null);
    }
  };

  const handleTerminate = async (store) => {
    setActingOn(store.id);
    try {
      const data = await secureApiCall(`/api/partners/${store.id}/contracts/${store.contract.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "terminated" })
      });
      if (data.success) {
        setStores((prev) =>
          prev.map((s) => (s.id === store.id ? { ...s, isPartner: false, contract: { ...s.contract, status: "terminated" } } : s))
        );
      }
    } catch (error) {
      console.error("Error terminating partnership:", error);
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div>
      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search vendors by name or slug..."
          className="w-full pl-9 pr-3 py-2 bg-gray-50 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-800 focus:bg-white transition-all duration-200"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 text-brand-700 animate-spin" />
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-white">
          {stores.length === 0 && (
            <p className="p-6 text-sm text-gray-400 text-center">No vendors found.</p>
          )}
          {stores.map((store) => {
            const contract = store.contract;
            return (
              <div key={store.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{store.storeName}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {store.storeSlug}
                    {!store.paystackReady && " · Not Paystack-ready"}
                  </p>
                  {contract && (contract.status === "accepted" || contract.status === "proposed") && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatRate(contract.rateType, contract.rateValue)} on campaign-driven sales
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {contract && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[contract.status] || "bg-gray-100 text-gray-500"}`}>
                      {contract.status === "proposed" ? "Pending response" : contract.status}
                    </span>
                  )}

                  {(!contract || contract.status === "declined" || contract.status === "terminated") && (
                    <button
                      onClick={() => setProposingStore(store)}
                      className="px-3 py-1.5 rounded-lg bg-brand-800 text-white text-xs font-semibold hover:bg-brand-900"
                    >
                      Propose contract
                    </button>
                  )}
                  {contract?.status === "proposed" && (
                    <button
                      onClick={() => handleWithdraw(store)}
                      disabled={actingOn === store.id}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:border-gray-300 disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  )}
                  {contract?.status === "accepted" && (
                    <button
                      onClick={() => handleTerminate(store)}
                      disabled={actingOn === store.id}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:border-red-300 disabled:opacity-50"
                    >
                      End partnership
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {proposingStore && (
        <ProposeContractModal
          store={proposingStore}
          onClose={() => setProposingStore(null)}
          onProposed={(contract) => handleProposed(proposingStore.id, contract)}
        />
      )}
    </div>
  );
}

export default function PartnersPage() {
  return (
    <AdminLayout title="Partner Vendors" subtitle="Propose and manage partnership contracts with vendors.">
      <PartnersPageContent />
    </AdminLayout>
  );
}
