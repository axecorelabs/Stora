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
    <div className="flex gap-2 flex-wrap">
      {PRICE_BUCKETS.map((bucket) => (
        <button
          key={bucket.key}
          onClick={() => onChange(activeKey === bucket.key ? null : bucket.key)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
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
