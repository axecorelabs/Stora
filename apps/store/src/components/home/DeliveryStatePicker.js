"use client";
import { useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { useDeliveryState } from "@/contexts/DeliveryStateContext";
import StatePickerPopover from "@/components/ui/StatePickerPopover";

// Desktop trigger -- white/70 text on the brand-800 header, matching the
// other icon+label actions already in that row (Wishlist, Account).
export function DeliveryStatePickerDesktop() {
  const { deliveryState, setDeliveryState } = useDeliveryState();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white transition-colors px-3 py-2"
      >
        <MapPin className="w-4 h-4 flex-shrink-0" />
        <span className="hidden lg:inline">Deliver to: {deliveryState || "Nigeria"}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 z-50">
            <StatePickerPopover value={deliveryState} onChange={setDeliveryState} onRequestClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

// Mobile slide-in-menu variant -- a full-width row, not a floating
// popover, consistent with everything else in that panel.
export function DeliveryStatePickerMobile() {
  const { deliveryState, setDeliveryState } = useDeliveryState();
  const [open, setOpen] = useState(false);

  return (
    <div className="pb-6 border-b border-gray-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-900">Deliver to: {deliveryState || "Nigeria"}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2">
          <StatePickerPopover value={deliveryState} onChange={setDeliveryState} onRequestClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
