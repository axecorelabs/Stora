"use client";
import { Check } from "lucide-react";

// Full-store's counterpart to ListingPlanPicker.js -- same segmented-control
// shape (see that file's comment for why: one plan, pick a cadence, not a
// row of competing price cards), full-store's own value props, and a 4th
// cycle (3 months).
const VALUE_PROPS = [
  "Sell products with a full storefront and checkout",
  "Accept and manage customer orders",
  "Use POS, inventory, and delivery tools",
  "Keep your storefront and payouts active"
];

const CYCLE_ORDER = ["monthly", "3month", "6month", "annual"];

export default function FullStorePlanPicker({ fullStorePlans, selectedCycle, onSelectCycle }) {
  const availableCycles = CYCLE_ORDER.filter((cycle) => fullStorePlans?.[cycle]?.available);

  return (
    <div className="text-left">
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-brand-50 p-1">
        {availableCycles.map((cycle) => {
          const plan = fullStorePlans[cycle];
          const isSelected = selectedCycle === cycle;
          return (
            <button
              key={cycle}
              type="button"
              onClick={() => onSelectCycle(cycle)}
              className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                isSelected ? "bg-white text-brand-900 shadow-sm" : "text-brand-700 hover:text-brand-900"
              }`}
            >
              {plan.label}
              {plan.savingsPercent > 0 && (
                <span className={`ml-1.5 ${isSelected ? "text-gold-700" : "text-gold-600"}`}>
                  &middot; save {plan.savingsPercent}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      <ul className="mt-5 space-y-2">
        {VALUE_PROPS.map((text) => (
          <li key={text} className="flex items-start gap-2 text-sm text-gray-600">
            <Check className="w-4 h-4 text-brand-700 flex-shrink-0 mt-0.5" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
