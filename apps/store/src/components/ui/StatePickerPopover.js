"use client";
import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { NIGERIAN_STATES } from "@stora/shared-constants";

// A controlled {value, onChange} primitive for picking one of the 37
// states -- too many for an always-visible pill row (unlike the ~9-13
// category treatment elsewhere), so it's a type-to-filter list instead.
// Deliberately just the list + a reset row, no trigger/positioning of its
// own -- callers (DeliveryStatePicker, StateFilterToken) own how/where
// this opens, since that differs between the header and the search
// console.
export default function StatePickerPopover({ value, onChange, onRequestClose }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NIGERIAN_STATES;
    return NIGERIAN_STATES.filter((s) => s.label.toLowerCase().includes(q));
  }, [query]);

  const pick = (stateValue) => {
    onChange(stateValue);
    onRequestClose?.();
  };

  return (
    <div className="w-72 bg-white rounded-2xl border border-gray-100 shadow-[0_12px_32px_rgba(11,59,46,0.14)] overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search states…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-brand-700/20"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto p-2">
        <button
          onClick={() => pick("")}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm text-left text-gray-900 hover:bg-gray-50"
        >
          Nationwide / No preference
          {!value && <Check className="w-3.5 h-3.5 text-brand-700 flex-shrink-0" />}
        </button>

        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-400 text-center">No states match &ldquo;{query}&rdquo;</p>
        ) : (
          filtered.map((s) => (
            <button
              key={s.value}
              onClick={() => pick(s.value)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm text-left text-gray-900 hover:bg-gray-50"
            >
              {s.label}
              {value === s.value && <Check className="w-3.5 h-3.5 text-brand-700 flex-shrink-0" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
