"use client";
import { useEffect } from "react";

// Fires once per real page load, from the visitor's own browser -- not
// from the server component's render, since [slug]/page.js and
// product/[id]/page.js are ISR-cached (see api/analytics/view/route.js's
// comment) and would badly undercount if counted server-side instead.
// navigator.sendBeacon is the right tool here: fire-and-forget, survives
// the page unloading immediately after, never blocks or delays rendering.
export default function ViewBeacon({ type, storeId, productId }) {
  useEffect(() => {
    const body = JSON.stringify({ type, storeId, productId });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/view", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/analytics/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    }
    // Intentionally fires once per mount only -- a re-render with the
    // same ids shouldn't double-count the same visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
