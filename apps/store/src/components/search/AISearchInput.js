"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X, ArrowUp, Loader2 } from "lucide-react";

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
export default function AISearchInput({
  value,
  onChange,
  placeholder,
  textClassName = "text-sm",
  minHeightClassName = "min-h-[3.25rem] sm:min-h-0",
  submitting = false,
  disabled = false,
  mobileHintText = "Press Enter to search",
}) {
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
    if (disabled || submitting) return;
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
      <div className="w-full min-w-0">
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder || "Describe what you're looking for — a vendor that sells ankara fabric, a birthday gift under ₦20k…"}
          // Enter-to-submit only works with a physical keyboard -- mobile's
          // virtual keyboard has no reliable Shift key, so a touch visitor
          // needs the explicit submit button below regardless. Two lines
          // tall by default on mobile (the familiar multi-line AI-input
          // shape people already recognize), collapsing to one line on
          // desktop where the compact search-bar look matters more and Enter
          // is always available. Grows beyond that as content wraps either way.
          className={`w-full min-w-0 bg-transparent outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed ${textClassName} font-medium text-brand-900 placeholder:text-[11px] sm:placeholder:text-sm placeholder-gray-400 py-2 pr-10 sm:pr-24 leading-snug ${minHeightClassName}`}
          style={{ maxHeight: `${MAX_HEIGHT_PX}px`, overflowY: "auto" }}
        />

        <div className="mt-1.5 flex items-center justify-between sm:hidden">
          <span className="text-[11px] text-brand-700/70">{mobileHintText}</span>
          <div className="flex items-center gap-1.5">
            {draft && (
              <button
                type="button"
                onClick={() => setDraft("")}
                className="text-gray-300 hover:text-gray-500 disabled:opacity-40"
                aria-label="Clear search"
                disabled={disabled || submitting}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              className="h-7 rounded-full bg-brand-700 text-white inline-flex items-center justify-center gap-1 px-2.5 hover:bg-brand-800 transition-colors flex-shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label={submitting ? "Searching" : "Ask AI"}
              disabled={disabled || submitting}
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5" />
              )}
              <span className="text-[10px] font-semibold">{submitting ? "Searching..." : "Ask AI"}</span>
            </button>
          </div>
        </div>

        {/* Desktop keeps controls anchored inside the input body. */}
        <div className="hidden sm:flex absolute right-0 bottom-1.5 items-center gap-1.5">
          {draft && (
            <button
              type="button"
              onClick={() => setDraft("")}
              className="text-gray-300 hover:text-gray-500 disabled:opacity-40"
              aria-label="Clear search"
              disabled={disabled || submitting}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            className="h-8 rounded-full bg-brand-700 text-white inline-flex items-center justify-center gap-1.5 px-3 hover:bg-brand-800 transition-colors flex-shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label={submitting ? "Searching" : "Ask AI"}
            disabled={disabled || submitting}
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5" />
            )}
            <span className="text-xs font-semibold">{submitting ? "Searching..." : "Ask AI"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
