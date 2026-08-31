"use client";
import { useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
      {children}
    </Link>
  );
}
