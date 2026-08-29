"use client";
import { useState } from "react";
import { X, Plus, Minus, ShoppingCart, Check } from "lucide-react";
import { normalizeExtraDefinitions } from "@stora/shared-constants";
import ExtrasSelector from "@/components/product/ExtrasSelector";
import { NOTE_PLACEHOLDERS } from "@/components/product/notePlaceholders";

// Quick customize-and-add from a product card, without leaving the grid --
// only shown for a product with real priced extras (see ProductCard.js's
// gating); a plain product still adds instantly, and a variant product
// still goes to its full page for the size/color picker, unchanged.
//
// Stays open after a successful add (resetting extras/note, not quantity)
// instead of closing, so picking different extras and adding again is the
// obvious next move -- that produces a second, correctly separate cart
// line via the cart's existing modifiers-aware line identity, not a
// merge. An explicit close is required to dismiss it.
export default function QuickAddModal({ isOpen, onClose, product, onAddToCart, primaryColor = '#0D9488', currency = 'NGN' }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [itemNote, setItemNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !product) return null;

  const extrasDefinitions = normalizeExtraDefinitions(product.categoryDetails?.food?.extras);
  const maxQuantity = product.availableQuantity || 0;

  const formatPrice = (price) => {
    if (currency === 'NGN') return `₦${price?.toLocaleString()}`;
    return `$${price?.toLocaleString()}`;
  };

  const selectedExtrasList = extrasDefinitions
    .map(def => ({ ...def, quantity: selectedExtras[def.name] || 0 }))
    .filter(e => e.quantity > 0);
  const extrasUnitCost = selectedExtrasList.reduce((sum, e) => sum + e.price * e.quantity, 0);
  const totalPrice = (product.sellingPrice + extrasUnitCost) * quantity;

  const buildModifiers = () => ({
    extras: selectedExtrasList.map(e => ({ name: e.name, quantity: e.quantity })),
    note: itemNote.trim()
  });

  const composeNotes = () => {
    const parts = [];
    if (selectedExtrasList.length > 0) {
      parts.push(selectedExtrasList.map(e => `${e.quantity}x ${e.name}`).join(', '));
    }
    if (itemNote.trim()) parts.push(itemNote.trim());
    return parts.join(' -- ');
  };

  const handleAdd = async () => {
    setIsAdding(true);
    setError(null);
    try {
      const result = await onAddToCart(product.id, quantity, {
        notes: composeNotes(),
        modifiers: buildModifiers()
      });
      if (result.success) {
        setJustAdded(true);
        setSelectedExtras({});
        setItemNote('');
        setTimeout(() => setJustAdded(false), 2000);
      } else {
        setError(result.error || 'Failed to add item to cart');
      }
    } catch (err) {
      setError('Failed to add item to cart');
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setQuantity(1);
    setSelectedExtras({});
    setItemNote('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100">
          <div>
            <h3 className="font-display text-lg font-semibold text-gray-900">{product.productName}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{formatPrice(product.sellingPrice)}</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">Quantity</label>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="px-4 py-2.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="w-12 text-center text-base font-semibold text-gray-900 tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                disabled={quantity >= maxQuantity}
                className="px-4 py-2.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          <ExtrasSelector
            extrasDefinitions={extrasDefinitions}
            selectedExtras={selectedExtras}
            onChange={setSelectedExtras}
            formatPrice={formatPrice}
            primaryColor={primaryColor}
          />

          <div>
            <label htmlFor="quick-add-note" className="text-sm font-semibold text-gray-900 mb-2 block">
              Note for the seller <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="quick-add-note"
              value={itemNote}
              onChange={(e) => setItemNote(e.target.value)}
              placeholder={NOTE_PLACEHOLDERS[product.category] || NOTE_PLACEHOLDERS.default}
              rows={2}
              maxLength={300}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-colors resize-none"
            />
          </div>

          <div className="bg-brand-50/60 border border-brand-100/70 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total</span>
              <span className="text-xl font-bold text-brand-800 tabular-nums">{formatPrice(totalPrice)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {quantity} {quantity === 1 ? 'item' : 'items'} × {formatPrice(product.sellingPrice + extrasUnitCost)}
              {extrasUnitCost > 0 && ` (${formatPrice(product.sellingPrice)} + ${formatPrice(extrasUnitCost)} extras)`}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {justAdded && (
            <div className="flex items-center gap-2 text-sm text-brand-800 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
              <Check className="w-4 h-4 shrink-0" />
              <span>Added! Want it differently? Pick new extras and add again.</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Done
          </button>
          <button
            onClick={handleAdd}
            disabled={isAdding || maxQuantity === 0}
            className="flex-1 py-3 px-4 rounded-xl text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-95"
            style={{ backgroundColor: primaryColor }}
          >
            {isAdding ? 'Adding…' : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Add to cart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
