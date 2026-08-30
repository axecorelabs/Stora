"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// A navigation must be in flight this long before the bar actually becomes
// visible -- most dashboard route changes resolve well under this, and a
// bar that flashes for under ~200ms reads as jittery noise rather than
// useful feedback. Only a genuinely slow transition (a network hiccup, a
// heavy page's own data fetch) ever gets far enough to show it.
const SHOW_DELAY_MS = 200;
// The bar eases toward this percentage without ever reaching it on its
// own -- we don't know how long a real navigation will take, so it just
// "trickles" to signal continued progress; only actual completion
// (pathname/search params settling below) snaps it to 100%.
const TRICKLE_TARGET = 88;
const TRICKLE_DURATION_MS = 4000;

// Module-level, not component state -- there's exactly one of these
// listeners (this component is mounted once, in DashboardHeader), but
// keeping the patch and the subscriber list outside the component means
// a remount (e.g. DashboardLayout re-rendering across a route change)
// never double-patches history.
const navigationListeners = new Set();
let patched = false;

function notifyNavigationStart() {
  navigationListeners.forEach((fn) => fn());
}

// Patches history.pushState/replaceState once per page load. There's no
// public Next.js App Router API for "a client-side navigation just
// started" -- both <Link> clicks and every router.push()/router.replace()
// call in this app (the sidebar, POS, SetupChecklist, and
// MobileBottomNav all navigate this way, not via <Link>) go through one
// of these two calls, so patching them is the one choke point that
// reliably catches every client-side navigation regardless of how it was
// triggered. popstate (back/forward) is listened to separately since
// browser navigation doesn't call either.
function ensurePatched() {
  if (patched || typeof window === "undefined") return;
  patched = true;

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = (...args) => {
    notifyNavigationStart();
    return originalPushState(...args);
  };
  window.history.replaceState = (...args) => {
    notifyNavigationStart();
    return originalReplaceState(...args);
  };
  window.addEventListener("popstate", notifyNavigationStart);
}

// Renders as the last child of DashboardHeader's fixed <header>, absolutely
// positioned to its bottom edge -- that tracks the header's real rendered
// height automatically (mobile vs. desktop, with or without the
// Restaurant Mode badge wrapping) instead of a separately-fixed bar
// guessing a pixel offset that could drift out of sync.
export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const isNavigatingRef = useRef(false);
  const showTimeoutRef = useRef(null);
  const trickleIntervalRef = useRef(null);
  const fadeTimeoutRef = useRef(null);

  useEffect(() => {
    ensurePatched();

    const handleStart = () => {
      // Already mid-navigation (e.g. a second push before the first
      // settled) -- let the existing trickle keep running rather than
      // resetting progress backwards.
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;

      showTimeoutRef.current = setTimeout(() => {
        setVisible(true);
        setProgress(15);
        const startedAt = Date.now();
        trickleIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - startedAt;
          const ratio = Math.min(1, elapsed / TRICKLE_DURATION_MS);
          // Eases quickly at first, slows as it nears the trickle target.
          setProgress(15 + (TRICKLE_TARGET - 15) * (1 - Math.pow(1 - ratio, 2)));
        }, 100);
      }, SHOW_DELAY_MS);
    };

    navigationListeners.add(handleStart);
    return () => navigationListeners.delete(handleStart);
  }, []);

  // pathname/searchParams settling is the "navigation complete" signal --
  // this fires once the new route has actually taken over the page.
  useEffect(() => {
    if (!isNavigatingRef.current) return;
    isNavigatingRef.current = false;
    clearTimeout(showTimeoutRef.current);
    clearInterval(trickleIntervalRef.current);

    setProgress((current) => {
      if (current === 0) return 0; // never showed -- resolved under SHOW_DELAY_MS
      fadeTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
      return 100;
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    return () => {
      clearTimeout(showTimeoutRef.current);
      clearInterval(trickleIntervalRef.current);
      clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute bottom-0 inset-x-0 h-[3px] overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="h-full bg-gradient-to-r from-brand-700 via-brand-800 to-gold-500"
        style={{
          width: `${progress}%`,
          transition: `width ${progress === 100 ? 150 : 300}ms ease-out, opacity 200ms ease-out ${progress === 100 ? '150ms' : '0ms'}`,
          opacity: progress === 100 ? 0 : 1
        }}
      />
    </div>
  );
}
