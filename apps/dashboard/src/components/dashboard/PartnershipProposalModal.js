"use client";
import { useState } from "react";
import { Handshake, Loader2, X } from "lucide-react";
import { usePartnershipProposal } from "@/contexts/PartnershipProposalContext";

function formatRate(rateType, rateValue) {
  return rateType === "flat" ? `₦${Number(rateValue).toLocaleString()} flat` : `${(Number(rateValue) * 100).toFixed(0)}%`;
}

// State lives in PartnershipProposalContext (mounted in the root
// layout) -- shared with DashboardHeader's pending-proposal indicator
// button, so dismissing here and reopening from the header both operate
// on the same contract/isModalOpen. Accepting/declining is what actually
// resolves the contract (see the respond route) -- dismissing does
// neither; it's remembered for 4 hours, then the modal reopens on its
// own (see the context's REAPPEAR_MS).
export default function PartnershipProposalModal() {
  const { contract, isModalOpen, dismiss, respond } = usePartnershipProposal();
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState(null);

  if (!contract || !isModalOpen) return null;

  const handleRespond = async (decision) => {
    setResponding(true);
    setError(null);
    try {
      const data = await respond(decision);
      if (!data.success) {
        setError(data.message || "Failed to submit your response");
      }
    } catch (err) {
      console.error("Error responding to partnership proposal:", err);
      setError("Failed to submit your response");
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
        <button
          onClick={dismiss}
          disabled={responding}
          aria-label="Ask me later"
          title="Ask me later"
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center mb-4">
          <Handshake className="w-6 h-6 text-brand-800" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Stora wants to partner with you</h2>
        <p className="text-sm text-gray-500 mb-5">
          We&apos;ll drive customers to {contract.storeName} through a marketing campaign, in exchange for the terms below on any sale it generates.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Rate on campaign-driven sales</span>
            <span className="font-semibold text-gray-900">{formatRate(contract.rateType, contract.rateValue)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Platform fee on these sales</span>
            <span className="font-semibold text-gray-900">Covered by the customer</span>
          </div>
          {contract.terms && (
            <p className="text-xs text-gray-500 pt-2 border-t border-gray-100 mt-2 leading-relaxed">{contract.terms}</p>
          )}
        </div>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

        <div className="flex gap-3">
          <button
            onClick={() => handleRespond("decline")}
            disabled={responding}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-300 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={() => handleRespond("accept")}
            disabled={responding}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-900 disabled:opacity-50"
          >
            {responding && <Loader2 className="w-4 h-4 animate-spin" />}
            Accept
          </button>
        </div>
        <button
          onClick={dismiss}
          disabled={responding}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-3 disabled:opacity-50"
        >
          Ask me later -- nothing is decided yet
        </button>
      </div>
    </div>
  );
}
