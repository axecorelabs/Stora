"use client";
import { useEffect, useRef } from "react";

// Tracks whether Paystack's inline.js has actually finished loading, and
// exposes a promise-based wait-for-ready helper with a timeout. This exact
// logic was previously duplicated inline in two places in
// apps/store/src/app/[slug]/cart/page.js -- pulled out here so a third
// copy (the order-details page's payment retry) doesn't have to be typed
// out (and potentially drift) a second time.
export function usePaystackReady() {
  const readyRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.PaystackPop) {
      readyRef.current = true;
      return;
    }
    const interval = setInterval(() => {
      if (typeof window !== "undefined" && window.PaystackPop) {
        readyRef.current = true;
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const markReady = () => {
    readyRef.current = true;
  };

  const waitForReady = (timeoutMs = 6000) => {
    if (readyRef.current || (typeof window !== "undefined" && window.PaystackPop)) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const start = Date.now();
      const check = setInterval(() => {
        if (typeof window !== "undefined" && window.PaystackPop) {
          clearInterval(check);
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(check);
          resolve(false);
        }
      }, 150);
    });
  };

  return { markReady, waitForReady };
}
