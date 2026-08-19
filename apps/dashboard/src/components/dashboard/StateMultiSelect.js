"use client";
import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { NIGERIAN_STATES } from "@stora/shared-constants";

// Searchable checkbox list over the 37 states -- no multi-select control
// exists anywhere in the dashboard app yet (the closest precedent, a
// toggle-pill row, lives in the store app for ~9-13 categories; 37 is too
// many for that shape, so this follows the store app's single-select
// StatePickerPopover's search+list layout instead, just with checkboxes).
export default function StateMultiSelect({ value = [], onChange }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NIGERIAN_STATES;
    return NIGERIAN_STATES.filter((s) => s.label.toLowerCase().includes(q));
  }, [query]);

  const toggle = (stateValue) => {
    onChange(
      value.includes(stateValue)
        ? value.filter((v) => v !== stateValue)
        : [...value, stateValue]
    );
  };

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden bg-white">
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search states…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-gray-50 text-sm text-black placeholder-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-brand-800/20"
          />
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-400 text-center">No states match &ldquo;{query}&rdquo;</p>
        ) : (
          filtered.map((s) => {
            const checked = value.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggle(s.value)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left text-black hover:bg-gray-50"
              >
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                    checked ? "bg-brand-800 border-brand-800" : "border-gray-300"
                  }`}
                >
                  {checked && <Check className="w-3 h-3 text-white" />}
                </span>
                {s.label}
              </button>
            );
          })
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
        {value.length === 0 ? "No states selected" : `${value.length} state${value.length === 1 ? "" : "s"} selected`}
      </div>
    </div>
  );
}
