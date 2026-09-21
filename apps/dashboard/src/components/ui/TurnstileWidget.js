"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// So callers can decide whether to gate their own submit button on a
// token ever arriving -- gating on that when this feature isn't
// configured yet would disable the button forever for no reason.
export const TURNSTILE_ENABLED = !!SITE_KEY;

// Cloudflare's bot check, Managed mode -- invisible for most visitors, a
// plain checkbox (no image/text puzzles) only for ones Cloudflare's own
// risk scoring flags. Renders nothing at all if NEXT_PUBLIC_TURNSTILE_SITE_KEY
// isn't set, matching lib/turnstile.js's server-side "not configured yet"
// behavior -- the two are meant to be turned on together, but neither one
// breaks signup if only one side has been configured so far.
//
// onVerify(token) fires on a successful check; onError() fires on both an
// expired or a failed check (the caller only needs "no longer have a
// valid token," not which of the two happened).
export default function TurnstileWidget({ onVerify, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.turnstile) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token) => onVerify(token),
      "expired-callback": () => onError?.(),
      "error-callback": () => onError?.()
    });

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // onVerify is a setState function from the parent -- identity doesn't
    // need to retrigger the widget render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
