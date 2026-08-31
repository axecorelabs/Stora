"use client";
import { useCallback, useEffect, useRef } from "react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { reportLinkPending } from "./linkNavigationStore";

// useLinkStatus() only works rendered inside the <Link> it reports on
// (Next wires it via context scoped to that one Link) -- this is that
// required child, invisible, just forwarding `pending` out to the shared
// store so NavigationLoadingOverlay can show feedback for a click that
// hasn't been prefetched. `pending` is exactly Next's own signal for "this
// navigation hasn't resolved yet," true whether or not prefetch ran.
function PendingReporter() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    reportLinkPending(pending);
    // Covers the unmount case too -- if this Link's subtree goes away
    // mid-navigation (e.g. the page it's on gets replaced by something
    // else first), the count must still drop back down.
    return () => reportLinkPending(false);
  }, [pending]);
  return null;
}

// Drop-in replacement for next/link's <Link> in "browse many" grids
// (vendor/product/category cards) -- Next's default prefetch fires for
// every card that merely scrolls into view, most of which never get
// clicked. Deferring the fetch to the first real interaction (hover,
// keyboard focus, or the start of a tap) keeps navigation feeling
// instant for cards someone actually engages with, without paying for
// the ones they don't. Not meant for one-off nav links/CTAs, where the
// click is likely enough that eager prefetch is worth it as-is.
export default function PrefetchLink({ href, children, ...rest }) {
  const router = useRouter();
  const prefetchedRef = useRef(false);

  const triggerPrefetch = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    router.prefetch(href);
  }, [router, href]);

  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={triggerPrefetch}
      onFocus={triggerPrefetch}
      onTouchStart={triggerPrefetch}
      {...rest}
    >
      <PendingReporter />
      {children}
    </Link>
  );
}
