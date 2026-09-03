"use client";
import { useState } from "react";
import { X, Plus, Minus, ShoppingCart } from "lucide-react";
import { normalizeExtraDefinitions } from "@stora/shared-constants";
import UnitExtrasConfigurator from "@/components/product/UnitExtrasConfigurator";
import { NOTE_PLACEHOLDERS } from "@/components/product/notePlaceholders";

// Same resize helper ProductDetailsClient.js uses for its own unitConfigs
// state -- growing copies entry 0 when mirroring ("same for all"), or
// blank entries when customizing each unit separately; shrinking
// truncates from the end.
function resizeUnitConfigs(prev, newLength, sameForAll) {
  if (newLength === prev.length) return prev;
  if (newLength < prev.length) return prev.slice(0, newLength);
  const template = sameForAll ? (prev[0] || { extras: {}, note: '' }) : { extras: {}, note: '' };
  const grown = [...prev];
  while (grown.length < newLength) grown.push({ extras: { ...template.extras }, note: template.note });
  return grown;
}

// Quick customize-and-add from a product card, without leaving the grid --
// only shown for a product with real priced extras (see ProductCard.js's
// gating); a plain product still adds instantly, and a variant product
// still goes to its full page for the size/color picker, unchanged.
//
// Per-unit customization (UnitExtrasConfigurator, the same component the
// full product page uses) lives right here now instead of handing off to
// that page -- this used to have a "customize each item separately? do it
// on the product page" link built via storeHref(), which assumes any
// non-apex subdomain is the vendor's own; true for a real vendor storefront,
// false on biterave.stora.com.ng (a shared host, never any one vendor's own
// subdomain) -- confirmed live: that link 404'd there. Reusing the same
// unitConfigs/sameForAll state shape and buildUnitPayload/sequential-add
// logic ProductDetailsClient.js already has, rather than inventing a
// second way to do the same thing, fixes the broken link by removing the
// navigation it needed in the first place.
export default function QuickAddModal({ isOpen, onClose, product, onAddToCart, primaryColor = '#0D9488', currency = 'NGN' }) {
  const [quantity, setQuantity] = useState(1);
  const [unitConfigs, setUnitConfigs] = useState([{ extras: {}, note: '' }]);
  const [sameForAll, setSameForAll] = useState(true);
  // How many unitConfigs entries are already committed to the cart this
  // add-to-cart attempt -- lets a retry after a partial failure resume
  // instead of resubmitting units already in the cart.
  const [submittedCount, setSubmittedCount] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !product) return null;

  const extrasDefinitions = normalizeExtraDefinitions(product.categoryDetails?.food?.extras);
  const maxQuantity = product.availableQuantity || 0;

  const formatPrice = (price) => {
    if (currency === 'NGN') return `₦${price?.toLocaleString()}`;
    return `$${price?.toLocaleString()}`;
  };

  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 1) return;
    const clamped = maxQuantity > 0 ? Math.min(newQuantity, maxQuantity) : newQuantity;
    setQuantity(clamped);
    setUnitConfigs((prev) => resizeUnitConfigs(prev, clamped, sameForAll));
    setSubmittedCount(0);
  };

  // Switching TO "same for all" mirrors unit 0 across every entry
  // (lossy by definition); switching away just changes how future writes
  // are targeted, existing per-unit data stays put.
  const handleSameForAllChange = (next) => {
    setSameForAll(next);
    if (next) {
      setUnitConfigs((prev) => {
        const base = prev[0] || { extras: {}, note: '' };
        return prev.map(() => ({ extras: { ...base.extras }, note: base.note }));
      });
    }
    setSubmittedCount(0);
  };

  const handleSharedExtrasChange = (next) => setUnitConfigs((prev) => prev.map((cfg) => ({ ...cfg, extras: next })));
  const handleSharedNoteChange = (next) => setUnitConfigs((prev) => prev.map((cfg) => ({ ...cfg, note: next })));
  const handleUnitExtrasChange = (index, next) => setUnitConfigs((prev) => prev.map((cfg, i) => (i === index ? { ...cfg, extras: next } : cfg)));
  const handleUnitNoteChange = (index, next) => setUnitConfigs((prev) => prev.map((cfg, i) => (i === index ? { ...cfg, note: next } : cfg)));

  const extrasCostFor = (cfg) => extrasDefinitions.reduce((sum, def) => sum + def.price * (cfg.extras[def.name] || 0), 0);
  const totalPrice = unitConfigs.reduce((sum, cfg) => sum + product.sellingPrice + extrasCostFor(cfg), 0);

  // Extras + freeform note both fold into the one notes column
  // cart_items already carries -- same shape ProductDetailsClient.js's
  // own buildUnitPayload produces.
  const buildUnitPayload = (cfg) => {
    const list = extrasDefinitions
      .map((def) => ({ ...def, quantity: cfg.extras[def.name] || 0 }))
      .filter((e) => e.quantity > 0);
    const parts = [];
    if (list.length > 0) parts.push(list.map((e) => `${e.quantity}x ${e.name}`).join(', '));
    if (cfg.note.trim()) parts.push(cfg.note.trim());
    return {
      notes: parts.join(' -- '),
      modifiers: { extras: list.map((e) => ({ name: e.name, quantity: e.quantity })), note: cfg.note.trim() }
    };
  };

  const handleClose = () => {
    setQuantity(1);
    setUnitConfigs([{ extras: {}, note: '' }]);
    setSameForAll(true);
    setSubmittedCount(0);
    setError(null);
    onClose();
  };

  // "Same for all" is one addToCart call. Customizing each unit
  // separately fires one addToCart per unit IN SEQUENCE (not parallel --
  // avoids racing the cart's own read-modify-write per request); two
  // units that happen to end up with identical modifiers still merge into
  // one line via the cart's existing identity logic. submittedCount
  // tracks how many units are already committed so a retry after a
  // mid-loop failure resumes instead of resubmitting (and duplicating)
  // units already added.
  const handleAdd = async () => {
    setIsAdding(true);
    setError(null);
    try {
      if (sameForAll) {
        const { notes, modifiers } = buildUnitPayload(unitConfigs[0] || { extras: {}, note: '' });
        const result = await onAddToCart(product.id, quantity, { notes, modifiers });
        if (result.success) {
          handleClose();
        } else {
          setError(result.error || 'Failed to add item to cart');
        }
        return;
      }

      let addedCount = submittedCount;
      for (let i = submittedCount; i < unitConfigs.length; i++) {
        const { notes, modifiers } = buildUnitPayload(unitConfigs[i]);
        const result = await onAddToCart(product.id, 1, { notes, modifiers });
        if (!result.success) {
          setSubmittedCount(addedCount);
          setError(
            addedCount > 0
              ? `Added ${addedCount} of ${quantity} -- item ${i + 1} failed: ${result.error || 'unknown error'}. Adjust it and try again.`
              : `Failed to add item ${i + 1}: ${result.error || 'unknown error'}`
          );
          return;
        }
        addedCount += 1;
        setSubmittedCount(addedCount);
      }
      handleClose();
    } catch (err) {
      setError('Failed to add item to cart');
    } finally {
      setIsAdding(false);
    }
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
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1}
                className="px-4 py-2.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="w-12 text-center text-base font-semibold text-gray-900 tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => handleQuantityChange(quantity + 1)}
                disabled={quantity >= maxQuantity}
                className="px-4 py-2.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          <UnitExtrasConfigurator
            quantity={quantity}
            extrasDefinitions={extrasDefinitions}
            unitConfigs={unitConfigs}
            sameForAll={sameForAll}
            onSameForAllChange={handleSameForAllChange}
            onSharedExtrasChange={handleSharedExtrasChange}
            onSharedNoteChange={handleSharedNoteChange}
            onUnitExtrasChange={handleUnitExtrasChange}
            onUnitNoteChange={handleUnitNoteChange}
            submittedCount={submittedCount}
            formatPrice={formatPrice}
            primaryColor={primaryColor}
            notePlaceholder={NOTE_PLACEHOLDERS[product.category] || NOTE_PLACEHOLDERS.default}
          />

          <div className="bg-brand-50/60 border border-brand-100/70 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total</span>
              <span className="text-xl font-bold text-brand-800 tabular-nums">{formatPrice(totalPrice)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{quantity} {quantity === 1 ? 'item' : 'items'}</p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
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
