"use client";
import { useEffect, useRef, useState } from "react";
import { Send, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { generateQrDataUrl } from "@/lib/generateQrDataUrl";

// How long the "waiting for you to open Telegram" state polls for before
// giving up and letting the vendor try again -- matches the linking
// code's own 10-minute Redis TTL loosely (no point polling well past when
// the code itself has expired), rounded down to something that doesn't
// leave someone staring at a spinner indefinitely if they got distracted.
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;

// Settings tab body -- mirrors VerificationForm.js's own
// fetchStatus/loading/connected-card/form shape. No batch Save here
// (Connect/Disconnect both act immediately), so there's no editData/
// validateForm layer to match, just a status fetch and two actions.
// Also embedded directly in the onboarding wizard (same pattern
// VerificationForm's own onVerified prop uses there) -- `onConnected`
// fires only once a poll actually observes a fresh connection, not on
// the initial mount check, matching onVerified's exact scope.
export default function TelegramForm({ onConnected }) {
  const { secureApiCall } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // { connected, username }
  const [deepLink, setDeepLink] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [linking, setLinking] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState(null);
  const pollTimerRef = useRef(null);
  const pollDeadlineRef = useRef(null);

  const fetchStatus = async () => {
    const response = await secureApiCall('/api/telegram/status');
    if (response?.success) {
      setStatus(response);
    }
    return response;
  };

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  };

  // Runs while `linking` is true -- checks /api/telegram/status every
  // couple of seconds until it comes back connected (the webhook handler
  // updated the store row from the other end) or the deadline passes.
  const pollUntilConnected = async () => {
    if (Date.now() > pollDeadlineRef.current) {
      setLinking(false);
      setLinkExpired(true);
      return;
    }
    const response = await fetchStatus();
    if (response?.connected) {
      setLinking(false);
      setDeepLink(null);
      setQrDataUrl(null);
      onConnected?.();
      return;
    }
    pollTimerRef.current = setTimeout(pollUntilConnected, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleConnect = async () => {
    setError(null);
    setLinkExpired(false);
    const response = await secureApiCall('/api/telegram/link', { method: 'POST' });
    if (response?.success) {
      setDeepLink(response.deepLink);
      setLinking(true);
      pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
      pollTimerRef.current = setTimeout(pollUntilConnected, POLL_INTERVAL_MS);

      // Same QR helper StoreQrCode.js/ProductQrCode.js already use --
      // lets someone on a laptop scan with their phone (where their
      // Telegram account actually lives) instead of needing the deep
      // link to somehow open on the same device they're using the
      // dashboard on. Best-effort: a failure here still leaves the
      // clickable link as a fallback, so it's not worth its own error UI.
      generateQrDataUrl(response.deepLink, "#0B3B2E")
        .then(setQrDataUrl)
        .catch((err) => console.error("Failed to generate Telegram link QR code:", err));
    } else {
      setError(response?.message || 'Could not start linking. Try again.');
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await secureApiCall('/api/telegram/disconnect', { method: 'POST' });
      if (response?.success) {
        setStatus({ connected: false, username: null });
      } else {
        setError(response?.message || 'Failed to disconnect');
      }
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-800" />
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-brand-800" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Connected{status.username ? ` as @${status.username}` : ''}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          New orders will be sent to this Telegram chat from now on.
        </p>
        <Button variant="secondary" onClick={handleDisconnect} disabled={isDisconnecting}>
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center gap-3 mb-2">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-100 text-brand-800 shrink-0">
          <Send className="w-4.5 h-4.5" />
        </span>
        <h2 className="text-lg font-semibold text-gray-900">Connect Telegram</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Get a message the moment a new order comes in, without needing to check email or the
        dashboard.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {linkExpired && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <p className="text-sm text-red-700">That link expired before you connected. Try again below.</p>
        </div>
      )}

      {linking && deepLink ? (
        <div className="space-y-4">
          {/* On a phone, the button below is enough -- Telegram opens
              right on the same device. On a laptop/desktop, Telegram is
              almost never open in a browser tab there, so a QR code lets
              someone scan it with the phone their Telegram account
              actually lives on instead. Same QR generator as the store's
              own website QR code, so it looks consistent with everywhere
              else this app shows one. */}
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="p-2.5 rounded-xl border border-gray-100 bg-white">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Scan with your phone's camera to connect Telegram" className="w-36 h-36" />
              ) : (
                <div className="w-36 h-36 bg-gray-100 rounded-lg animate-pulse" />
              )}
            </div>
            <p className="text-xs text-gray-400">On a computer? Scan this with your phone&apos;s camera.</p>
          </div>

          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-900 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Telegram to finish connecting
          </a>
          <p className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Waiting for you to tap Start in Telegram...
          </p>
        </div>
      ) : (
        <Button variant="primary" onClick={handleConnect} className="w-full">
          <Send className="w-4 h-4" />
          Connect Telegram
        </Button>
      )}
    </div>
  );
}
