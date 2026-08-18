"use client";

// Preset buckets rather than raw min/max number inputs -- fewer taps, and
// grounded in this catalog's real spread rather than a generic default:
// the live data runs from ~₦500 books to ₦2.2M phones in the same grid,
// so "under ₦5k" is a genuinely useful first cut, not an arbitrary round
// number.
export const PRICE_BUCKETS = [
  { key: "under-5k", label: "Under ₦5k", min: undefined, max: 5000 },
  { key: "5k-20k", label: "₦5k – ₦20k", min: 5000, max: 20000 },
  { key: "20k-100k", label: "₦20k – ₦100k", min: 20000, max: 100000 },
  { key: "over-100k", label: "Over ₦100k", min: 100000, max: undefined },
];

export default function PriceFilterPills({ activeKey, onChange }) {
  return (
    // Sits alongside the sort toggle in a justify-between row, so unlike the
    // full-bleed category pills this one stays contained -- it scrolls
    // horizontally within its own share of that row on mobile instead of
    // wrapping to several lines, and reverts to the original wrap on desktop.
    <div className="flex gap-2 flex-nowrap overflow-x-auto scrollbar-hide sm:flex-wrap sm:overflow-visible min-w-0 flex-1 sm:flex-initial">
      {PRICE_BUCKETS.map((bucket) => (
        <button
          key={bucket.key}
          onClick={() => onChange(activeKey === bucket.key ? null : bucket.key)}
          className={`flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            activeKey === bucket.key
              ? "bg-brand-700 text-white border-brand-700"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          {bucket.label}
        </button>
      ))}
    </div>
  );
}
