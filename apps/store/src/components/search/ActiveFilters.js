"use client";
import { X } from "lucide-react";

// Only renders when something's actually applied -- the base "browse
// everything" state stays exactly as clean as it always was. `filters` is
// [{key, label, onRemove}]; showing this lets someone see and undo one
// specific facet without losing the others (vs. re-deriving "what's on"
// from a row of chips that don't visually distinguish active from idle).
export default function ActiveFilters({ filters, onClearAll }) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mb-5">
      <span className="text-xs text-gray-400 flex-shrink-0">Filters:</span>
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={filter.onRemove}
          className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-brand-50 text-brand-800 text-xs font-medium hover:bg-brand-100 transition-colors"
        >
          {filter.label}
          <X className="w-3 h-3" />
        </button>
      ))}
      {filters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
