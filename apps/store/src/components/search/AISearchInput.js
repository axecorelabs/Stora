"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X, ArrowUp } from "lucide-react";

const MAX_HEIGHT_PX = 120; // roughly 5-6 lines before it scrolls internally

// Rendered by SearchConsole instead of SearchTypeahead when AI mode is on.
// A deliberately different interaction model, not a mode flag inside
// SearchTypeahead -- multi-line composition, no live preview, explicit
// submit -- see the AI-search plan for why those don't mix well with a
// single-line, per-keystroke-preview component. Same controlled
// value/onChange contract as SearchTypeahead though, so SearchConsole can
// swap between the two without the parent page knowing the difference:
// onChange only fires on submit, which the page treats exactly like a
// committed search query, same as "See all" does for the keyword typeahead.
export default function AISearchInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState(value || "");
  const textareaRef = useRef(null);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT_PX) + "px";
  }, [draft]);

  const submit = () => {
    const q = draft.trim();
    if (q) onChange(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    // Shift+Enter falls through to the textarea's default behavior --
    // inserts a real newline, for genuine multi-line composition.
  };

  return (
    <div className="relative w-full flex items-start gap-1.5">
      <Sparkles className="w-3.5 h-3.5 text-brand-400 flex-shrink-0 mt-2" />
      <textarea
        ref={textareaRef}
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Describe what you're looking for — a vendor that sells ankara fabric, a birthday gift under ₦20k…"}
        // Enter-to-submit only works with a physical keyboard -- mobile's
        // virtual keyboard has no reliable Shift key, so a touch visitor
        // needs the explicit submit button below regardless. Two lines
        // tall by default on mobile (the familiar multi-line AI-input
        // shape people already recognize), collapsing to one line on
        // desktop where the compact search-bar look matters more and Enter
        // is always available. Grows beyond that as content wraps either way.
        className="w-full min-w-0 bg-transparent outline-none resize-none text-base sm:text-sm font-medium text-brand-900 placeholder-gray-400 py-2 pr-9 leading-snug min-h-[3.25rem] sm:min-h-0"
        style={{ maxHeight: `${MAX_HEIGHT_PX}px`, overflowY: "auto" }}
      />
      {/* Bottom-anchored, not vertically centered -- keeps both controls in
          a stable spot as the textarea grows upward with more lines,
          instead of drifting to the middle of a tall box. */}
      <div className="absolute right-0 bottom-1.5 flex items-center gap-1.5">
        {draft && (
          <button
            type="button"
            onClick={() => setDraft("")}
            className="text-gray-300 hover:text-gray-500"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {draft.trim() && (
          <button
            type="button"
            onClick={submit}
            className="w-6 h-6 rounded-full bg-brand-700 text-white flex items-center justify-center hover:bg-brand-800 transition-colors flex-shrink-0"
            aria-label="Search"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
