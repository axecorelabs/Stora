"use client";
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";

const PartnershipProposalContext = createContext(null);

const DISMISS_KEY_PREFIX = "stora-partnership-dismissed-at-";
const REAPPEAR_MS = 4 * 60 * 60 * 1000; // 4 hours

export function usePartnershipProposal() {
  const ctx = useContext(PartnershipProposalContext);
  if (!ctx) throw new Error("usePartnershipProposal must be used within PartnershipProposalProvider");
  return ctx;
}

// Mounted once in the root layout (app/layout.js, not the per-page
// DashboardLayout) so its state survives navigation between dashboard
// pages -- DashboardHeader (the pending-proposal indicator button) and
// PartnershipProposalModal both read the same contract/isModalOpen here
// instead of each fetching independently.
//
// "Dismiss" (X or "ask me later") never touches the contract itself --
// it just remembers *when* via localStorage (not sessionStorage: a real
// wall-clock cooldown should survive a closed tab, not just a
// navigation) and reschedules the modal to reopen on its own 4 hours
// later, matching the confirmed "keep reminding them" behavior. A
// header click reopens it immediately regardless of the cooldown.
export function PartnershipProposalProvider({ children }) {
  const { secureApiCall, isAuthenticated } = useAuth();
  const [contract, setContract] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [justDismissed, setJustDismissed] = useState(false);
  const reappearTimer = useRef(null);
  const dismissedHintTimer = useRef(null);

  const scheduleReappear = useCallback((remainingMs) => {
    clearTimeout(reappearTimer.current);
    reappearTimer.current = setTimeout(() => setIsModalOpen(true), remainingMs);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const data = await secureApiCall("/api/partnership/pending");
        if (!data.success || !data.contract) return;
        setContract(data.contract);

        const dismissedAtRaw = localStorage.getItem(`${DISMISS_KEY_PREFIX}${data.contract.id}`);
        if (!dismissedAtRaw) {
          setIsModalOpen(true);
          return;
        }
        const elapsed = Date.now() - parseInt(dismissedAtRaw, 10);
        if (elapsed >= REAPPEAR_MS) {
          setIsModalOpen(true);
        } else {
          scheduleReappear(REAPPEAR_MS - elapsed);
        }
      } catch (err) {
        console.error("Error checking for pending partnership proposal:", err);
      }
    })();

    return () => {
      clearTimeout(reappearTimer.current);
      clearTimeout(dismissedHintTimer.current);
    };
  }, [isAuthenticated, secureApiCall, scheduleReappear]);

  const dismiss = () => {
    if (!contract) return;
    localStorage.setItem(`${DISMISS_KEY_PREFIX}${contract.id}`, String(Date.now()));
    setIsModalOpen(false);
    scheduleReappear(REAPPEAR_MS);

    // Brief "find it here" hint the header button shows near itself --
    // auto-clears so it doesn't linger indefinitely.
    setJustDismissed(true);
    clearTimeout(dismissedHintTimer.current);
    dismissedHintTimer.current = setTimeout(() => setJustDismissed(false), 6000);
  };

  const openModal = () => {
    setJustDismissed(false);
    setIsModalOpen(true);
  };

  const respond = async (decision) => {
    const data = await secureApiCall(`/api/partnership/${contract.id}/respond`, {
      method: "PATCH",
      body: JSON.stringify({ decision })
    });
    if (data.success) {
      clearTimeout(reappearTimer.current);
      localStorage.removeItem(`${DISMISS_KEY_PREFIX}${contract.id}`);
      setContract(null);
      setIsModalOpen(false);
    }
    return data;
  };

  return (
    <PartnershipProposalContext.Provider value={{ contract, isModalOpen, justDismissed, dismiss, openModal, respond }}>
      {children}
    </PartnershipProposalContext.Provider>
  );
}
