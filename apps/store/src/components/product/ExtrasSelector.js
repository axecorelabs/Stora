"use client";
import { Plus, Minus } from "lucide-react";

// Priced/limited extras stepper list -- shared between ProductDetailsClient.js
// (the full product page) and QuickAddModal.js (the grid's quick-add), so
// the two surfaces can't visually drift apart. Presentational only: the
// caller owns `selectedExtras` state (a plain {name: quantity} map) and
// passes it back through `onChange`.
export default function ExtrasSelector({ extrasDefinitions, selectedExtras, onChange, formatPrice, primaryColor }) {
  if (!extrasDefinitions || extrasDefinitions.length === 0) return null;

  return (
    <div>
      <label className="text-sm font-semibold text-gray-900 mb-2 block">
        Extras <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <div className="space-y-2">
        {extrasDefinitions.map((extra) => {
          const qty = selectedExtras[extra.name] || 0;
          return (
            <div
              key={extra.name}
              className="flex items-center justify-between px-3.5 py-2 rounded-xl border border-gray-200 bg-white"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{extra.name}</p>
                <p className="text-xs text-gray-500">
                  {extra.price > 0 ? `+${formatPrice(extra.price)} each` : 'Free'}
                  {extra.maxQuantity > 1 && ` · up to ${extra.maxQuantity}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onChange({ ...selectedExtras, [extra.name]: Math.max(0, qty - 1) })}
                  disabled={qty <= 0}
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className={`w-4 text-center text-sm font-semibold tabular-nums ${qty > 0 && qty >= extra.maxQuantity ? 'text-gold-600' : 'text-gray-900'}`}>{qty}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...selectedExtras, [extra.name]: Math.min(extra.maxQuantity, qty + 1) })}
                  disabled={qty >= extra.maxQuantity}
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  style={qty < extra.maxQuantity ? { borderColor: primaryColor, color: primaryColor } : undefined}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
