"use client";
import { Check } from "lucide-react";

// Shared by the onboarding wizard's 'subscribe' step and
// /dashboard/subscription -- both used to just say "subscribe" with a
// flat price and no reason why. These bullets map 1:1 to what
// ListingShowcase.js actually gates behind an active subscription
// (WhatsApp contact, real gallery, reviews, ranking boost), not generic
// marketing copy.
const VALUE_PROPS = [
  "Chat with customers on WhatsApp, not just phone or email",
  "Show up to 10 real photos of your business",
  "Let customers leave reviews that build trust",
  "Rank above free listings in search and on the homepage"
];

const CYCLE_ORDER = ["monthly", "6month", "annual"];

const formatNaira = (kobo) => `₦${(kobo / 100).toLocaleString()}`;

export default function ListingPlanPicker({ listingPlans, selectedCycle, onSelectCycle }) {
  return (
    <div className="text-left">
      <ul className="space-y-2 mb-5">
        {VALUE_PROPS.map((text) => (
          <li key={text} className="flex items-start gap-2 text-sm text-gray-700">
            <Check className="w-4 h-4 text-brand-800 flex-shrink-0 mt-0.5" />
            {text}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-3 gap-2 mb-1">
        {CYCLE_ORDER.map((cycle) => {
          const plan = listingPlans?.[cycle];
          if (!plan?.available) return null;
          const isSelected = selectedCycle === cycle;
          return (
            <button
              key={cycle}
              type="button"
              onClick={() => onSelectCycle(cycle)}
              className={`relative rounded-xl border-2 px-2 py-3 text-center transition-colors ${
                isSelected ? "border-brand-800 bg-brand-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {plan.savingsPercent > 0 && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  Save {plan.savingsPercent}%
                </span>
              )}
              <p className="text-xs font-semibold text-gray-900">{plan.label}</p>
              <p className="mt-1 text-sm font-bold text-gray-900">{formatNaira(plan.amountKobo)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
