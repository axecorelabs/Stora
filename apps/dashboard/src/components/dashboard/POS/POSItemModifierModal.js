"use client";
import { useState } from "react";
import { X, MessageSquare, Plus, Minus } from "lucide-react";
import { normalizeExtraDefinitions } from "@stora/shared-constants";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0
  }).format(amount || 0);
};

// Same extras-steppers + note-textarea pattern as the storefront's
// ProductDetailsClient.js -- a cashier picking modifiers for a food item
// mid-sale should feel like the same feature, not a different one. Each
// extra carries its own price and a vendor-set max quantity now, instead
// of a plain on/off toggle.
//
// The parent remounts this (via a `key` that changes across every
// open/close cycle) instead of this component syncing its local state to
// `item` through an effect -- that keeps the lazy useState initializers
// below as the single source of the modal's starting values, with no
// setState-in-effect render cascade.
export default function POSItemModifierModal({ isOpen, onClose, item, onSave, saveLabel = 'Save' }) {
  const extras = normalizeExtraDefinitions(item?.categoryDetails?.food?.extras);

  // Map of extra name -> selected quantity, seeded from whatever this line
  // already had selected (item.modifiers.extras is the {name, price,
  // quantity} snapshot -- only name/quantity matter for re-seeding here).
  const [selectedExtras, setSelectedExtras] = useState(() => {
    const seed = {};
    for (const e of (item?.modifiers?.extras || [])) {
      if (e?.name) seed[e.name] = e.quantity || 0;
    }
    return seed;
  });
  const [note, setNote] = useState(() => item?.modifiers?.note || '');

  if (!isOpen || !item) return null;

  const basePrice = item.basePrice ?? item.sellingPrice ?? 0;
  const extrasUnitCost = extras.reduce((sum, e) => sum + e.price * (selectedExtras[e.name] || 0), 0);

  const handleSave = () => {
    const requestedExtras = extras
      .map(e => ({ name: e.name, quantity: selectedExtras[e.name] || 0 }))
      .filter(e => e.quantity > 0);
    onSave({ extras: requestedExtras, note: note.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-100 rounded-xl shrink-0">
              <MessageSquare className="w-5 h-5 text-brand-800" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Customize item</h3>
              <p className="text-sm text-gray-500">{item.displayName || item.productName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 lg:p-6 space-y-4">
          {extras.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">
                Extras <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="space-y-2">
                {extras.map((extra) => {
                  const qty = selectedExtras[extra.name] || 0;
                  return (
                    <div
                      key={extra.name}
                      className="flex items-center justify-between px-3.5 py-2 rounded-xl border border-gray-200 bg-white"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{extra.name}</p>
                        <p className="text-xs text-gray-500">
                          {extra.price > 0 ? `+${formatCurrency(extra.price)} each` : 'Free'}
                          {extra.maxQuantity > 1 && ` · up to ${extra.maxQuantity}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedExtras((prev) => ({ ...prev, [extra.name]: Math.max(0, qty - 1) }))}
                          disabled={qty <= 0}
                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className={`w-4 text-center text-sm font-semibold tabular-nums ${qty > 0 && qty >= extra.maxQuantity ? 'text-gold-600' : 'text-gray-900'}`}>{qty}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedExtras((prev) => ({ ...prev, [extra.name]: Math.min(extra.maxQuantity, qty + 1) }))}
                          disabled={qty >= extra.maxQuantity}
                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-brand-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="pos-item-note" className="text-sm font-semibold text-gray-900 mb-2 block">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="pos-item-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. no onions, extra spicy…"
              rows={2}
              maxLength={300}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-colors resize-none"
            />
          </div>

          {extrasUnitCost > 0 && (
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-gray-500">New price per item</span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {formatCurrency(basePrice)} + {formatCurrency(extrasUnitCost)} = {formatCurrency(basePrice + extrasUnitCost)}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 lg:p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors font-medium"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
