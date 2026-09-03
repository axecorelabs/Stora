"use client";
import { useEffect, useRef, useState } from "react";
import { ChefHat } from "lucide-react";

// Quick-jump nav across a single restaurant's own menu -- one tile per
// menu section (Starters, Mains, ...) plus Groceries when the store
// carries any, each showing that section's own first available item
// photo. Purely additive on top of BiteraveStoreMenu: it only scrolls to
// an existing section heading (via id + scroll-mt, see the heading
// elements it targets) and tracks which one is currently in view --
// none of the page's search/filtering logic is touched.
export default function CategorySectionStrip({ sections }) {
  const [activeAnchor, setActiveAnchor] = useState(sections[0]?.anchor || null);
  const observerRef = useRef(null);

  useEffect(() => {
    const targets = sections.map(({ anchor }) => document.getElementById(anchor)).filter(Boolean);
    if (targets.length === 0) return;

    // Narrow band near the top of the viewport, not the whole screen --
    // otherwise two adjacent sections both count as "visible" for most
    // of the scroll and the active tile flickers between them.
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveAnchor(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    targets.forEach((target) => observerRef.current.observe(target));
    return () => observerRef.current?.disconnect();
  }, [sections]);

  // A single-section menu has nothing to jump between.
  if (sections.length < 2) return null;

  const scrollToSection = (anchor) => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
      {sections.map(({ label, image, anchor }) => {
        const active = activeAnchor === anchor;
        return (
          <button
            key={anchor}
            type="button"
            onClick={() => scrollToSection(anchor)}
            className="flex-shrink-0 flex flex-col items-center gap-2 w-20"
          >
            <span
              className={`w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-200 ${
                active ? "ring-2 ring-brand-800 ring-offset-2" : "ring-1 ring-gray-100"
              }`}
            >
              {image ? (
                <img src={image} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full bg-brand-50 flex items-center justify-center">
                  <ChefHat className="w-5 h-5 text-brand-700" />
                </span>
              )}
            </span>
            <span
              className={`text-xs text-center truncate w-full ${
                active ? "font-semibold text-brand-900" : "font-medium text-gray-500"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
