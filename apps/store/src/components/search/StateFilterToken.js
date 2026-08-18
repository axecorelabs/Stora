"use client";
import { useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import StatePickerPopover from "@/components/ui/StatePickerPopover";

// A hard filter chip -- unlike the header's "Deliver to" picker (a soft
// preference that never hides anyone), picking a state here excludes
// non-matching vendors/products from the grid. Reuses the same
// StatePickerPopover as the header picker rather than a second list
// component.
export default function StateFilterToken({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
          open || value
            ? "bg-brand-50 border-brand-300 text-brand-900"
            : "bg-white border-gray-200 text-brand-800 hover:border-brand-300"
        }`}
      >
        <MapPin className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
        {value || "Any state"}
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 z-50">
            <StatePickerPopover value={value} onChange={onChange} onRequestClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
