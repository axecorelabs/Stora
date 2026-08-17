"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

// Debounced live search -- both /products and /vendors are now backed by
// indexed Postgres queries (see 20260817000005_vendor_product_search.sql),
// fast enough that searching as-you-type is reasonable rather than
// requiring an explicit submit.
export default function SearchBar({ value, onChange, placeholder, debounceMs = 350 }) {
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    if (draft === (value || "")) return;
    const timer = setTimeout(() => onChange(draft), debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-10 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-colors"
      />
      {draft && (
        <button
          type="button"
          onClick={() => setDraft("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
