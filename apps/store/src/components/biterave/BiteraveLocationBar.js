"use client";
import { MapPin, ChevronDown } from "lucide-react";
import StatePickerPopover from "@/components/ui/StatePickerPopover";

// Paired with useBiteraveLocationScope -- shows what's actually being
// filtered on (or that nothing is, if the shopper has no known state yet)
// and gives an explicit way out of the hard filter, so "scoped by
// default" never reads as "silently hiding restaurants with no way to
// find out why." Same StatePickerPopover + backdrop-to-close pattern
// /products/page.js already uses for its own state pickers.
export default function BiteraveLocationBar({ scope }) {
  const { deliveryState, setDeliveryState, seeAll, setSeeAll, showPicker, setShowPicker, scoped } = scope;

  return (
    <div className="relative flex items-center gap-3 flex-wrap mb-5 text-sm">
      <button
        type="button"
        onClick={() => setShowPicker((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-brand-100 bg-brand-50/60 text-brand-800 font-medium hover:border-brand-300 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5" />
        {deliveryState ? `Near ${deliveryState}` : "Set your location"}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {deliveryState && (
        <button
          type="button"
          onClick={() => setSeeAll((v) => !v)}
          className="text-xs font-medium text-gray-500 hover:text-brand-700 underline underline-offset-2"
        >
          {scoped ? "See all locations" : `Show ${deliveryState} only`}
        </button>
      )}

      {showPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
          <div className="absolute left-0 top-full mt-2 z-50">
            <StatePickerPopover
              value={deliveryState}
              onChange={(value) => {
                setDeliveryState(value);
                setSeeAll(false);
              }}
              onRequestClose={() => setShowPicker(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
