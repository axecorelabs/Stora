"use client";
import { useEffect, useRef, useState } from "react";
import LoadingOverlay from "./LoadingOverlay";
import { subscribeLinkPending } from "./linkNavigationStore";

// Deferred prefetching (PrefetchLink -- hover/focus/touch instead of
// viewport-entry, see CategoryDiscovery.js/VendorCard.js/etc.) means a
// click on a card that was never hovered or touched first has nothing
// cached to navigate into instantly. Before this, the only place
// LoadingOverlay ever showed was 5 components manually flagging
// isNavigating before their OWN router.push() calls (Wishlist, Orders,
// cart, back buttons) -- a PrefetchLink click, which is every
// product/vendor/category card on the site, never showed any loading
// feedback at all.
//
// This is driven by PrefetchLink's own useLinkStatus() reporting into
// linkNavigationStore, NOT by patching history.pushState/replaceState the
// way apps/dashboard's NavigationProgressBar does. That was tried first
// here and measured wrong: for an App Router <Link> click, pushState only
// fires once the new route's RSC payload has ALREADY fully arrived (a
// live Playwright test under throttled network showed the one pushState
// call landing at the same moment the URL changed -- there is no
// "in-flight" window between the two), so it only ever signals
// navigation having just FINISHED, never having started. useLinkStatus()
// is Next's own purpose-built signal for "this Link's navigation hasn't
// resolved yet," true from the moment the click is handled.
const SHOW_DELAY_MS = 200;

export default function NavigationLoadingOverlay() {
  const [visible, setVisible] = useState(false);
  const showTimeoutRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeLinkPending((anyPending) => {
      if (anyPending) {
        showTimeoutRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      } else {
        clearTimeout(showTimeoutRef.current);
        setVisible(false);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(showTimeoutRef.current);
    };
  }, []);

  return <LoadingOverlay isVisible={visible} />;
}
