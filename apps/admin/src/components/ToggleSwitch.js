"use client";
import { Loader2 } from "lucide-react";

// Shared by Vendors' (x3) and Products' (x1) toggles -- `loading` shows a
// small spinner in place of the switch instead of just disabling it, so
// a pending PATCH doesn't look identical to an inert control.
export default function ToggleSwitch({ checked, loading, onChange, label }) {
  if (loading) {
    return (
      <span className="inline-flex items-center justify-center w-9 h-5" title={label}>
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
      </span>
    );
  }

  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0" title={label}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-800"></div>
    </label>
  );
}
