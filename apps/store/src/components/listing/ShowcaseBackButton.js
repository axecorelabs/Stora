"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const BUTTON_CLASSNAME = "pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-white/90 text-black shadow-sm backdrop-blur transition hover:bg-white sm:h-12 sm:w-12";
const ICON = <ChevronLeft className="h-4 w-4 stroke-[3] sm:h-6 sm:w-6" />;

// Was a hardcoded link straight to the marketing homepage regardless of how
// the visitor actually got here -- from /vendors, a search result, another
// listing, or a shared link, "back" always dumped them on stora.com.ng.
// A same-origin document.referrer means they navigated here from
// somewhere else in Stora, so router.back() correctly returns them there
// (the vendor list, search results, whatever it was). No referrer, or a
// referrer from outside Stora (a direct/shared link opened fresh), means
// there's nothing in OUR history to go back to -- falls back to the
// business directory instead of stranding them on an unrelated page.
export default function ShowcaseBackButton() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // Deferred into a rAF callback (not called synchronously in the effect
    // body) -- same pattern AIHeroSearch.js already uses for a one-time
    // client-only read, avoids the set-state-in-effect lint rule for what
    // is otherwise a legitimate "sync a browser-only value on mount" case.
    const raf = requestAnimationFrame(() => {
      try {
        const ref = document.referrer;
        setCanGoBack(!!ref && new URL(ref).origin === window.location.origin);
      } catch {
        setCanGoBack(false);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (canGoBack) {
    return (
      <button type="button" onClick={() => router.back()} aria-label="Go back" className={BUTTON_CLASSNAME}>
        {ICON}
      </button>
    );
  }

  return (
    <Link href="/vendors" aria-label="Back to businesses" className={BUTTON_CLASSNAME}>
      {ICON}
    </Link>
  );
}
