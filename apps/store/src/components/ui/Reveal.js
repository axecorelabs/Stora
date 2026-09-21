"use client";
import { useEffect, useRef, useState } from "react";

// One-shot scroll reveal -- fades/rises an element into place the first
// time it enters the viewport, then leaves it alone (no re-triggering on
// scroll-back, no looping, no scroll-linked position tracking -- all of
// which are the usual sources of visible jank on a page with any real
// content weight). Only opacity/transform change, so the whole transition
// is compositor-driven and never touches layout.
//
// motion-reduce:opacity-100 (rather than a JS check) is what actually
// disables this for prefers-reduced-motion -- Tailwind's own variant, so
// there's no hydration-order dependency on reading the media query in JS.
//
// The "reveal-hidden" class (alongside the Tailwind opacity/translate
// utilities, not instead of them) is a dedicated hook for the <noscript>
// override in layout.js -- opacity-0/translate-y-* are generic utilities
// reused all over this app for unrelated purposes (hover overlays, cart
// button visibility, etc.), so forcing THOSE visible with JS disabled
// would break other components; this class name is only ever used here.
export default function Reveal({ children, className = "", as: Tag = "div", delayMs = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // IntersectionObserver, not a scroll listener -- fires once per
    // element, off the main thread's scroll-event cadence entirely.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        visible ? "opacity-100 translate-y-0" : "reveal-hidden opacity-0 translate-y-6"
      } ${className}`}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
