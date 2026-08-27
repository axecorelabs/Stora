"use client";
import { useState, useEffect } from "react";
import { X, Undo2, PackageCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const FULFILLED_ITEM_STATUSES = ['shipped', 'delivered'];

const formatCurrency = (amount) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0
}).format(amount || 0);

// Vendor-facing refund action -- calls POST /api/orders/[id]/refund
// directly (matching OrderDetailsContent's own refreshOrderData, which
// already calls secureApiCall itself rather than going through a
// parent-supplied mutation) since neither of this modal's callers (the
// order-detail popup, the Orders list row) has an existing refund
// mutation to thread through. Bookkeeping-only, by design -- see the
// module comment on the API route this posts to: no money actually
// moves here, only records and stock adjust.
//
// `order` only needs an `id` -- both callers open this modal immediately
// on click (rather than fetching first and making the button itself look
// stuck/unresponsive), and the modal fetches the full canonical order
// itself, showing a loading state in its own body while that's in
// flight. This also means the ceiling/items shown are always freshly
// fetched at the moment of refunding, not whatever the caller's list or
// popup last happened to have cached.
export default function RefundModal({ isOpen, onClose, order, onRefundComplete }) {
  const { secureApiCall } = useAuth();
  const [fullOrder, setFullOrder] = useState(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refundType, setRefundType] = useState('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [note, setNote] = useState('');
  const [restockItemIds, setRestockItemIds] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRefundType('full');
      setPartialAmount('');
      setNote('');
      setRestockItemIds(new Set());
      setErrors({});
    }
  }, [isOpen, order?.id]);

  useEffect(() => {
    if (isOpen && order?.id) {
      setFullOrder(null);
      setLoadError('');
      setIsLoadingOrder(true);
      (async () => {
        try {
          const response = await secureApiCall(`/api/orders/${order.id}`);
          if (response.success) {
            setFullOrder(response.data);
          } else {
            setLoadError(response.message || 'Failed to load order');
          }
        } catch (error) {
          setLoadError(error.message || 'Failed to load order');
        } finally {
          setIsLoadingOrder(false);
        }
      })();
    }
  }, [isOpen, order?.id, secureApiCall]);

  if (!isOpen || !order) return null;

  const ceiling = fullOrder?.refundSplit?.netAmountToVendor || 0;
  const items = fullOrder?.items || [];
  const orderNumber = fullOrder?.orderNumber || order.orderNumber || '';

  const toggleRestock = (itemId) => {
    setRestockItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const validate = () => {
    const newErrors = {};
    if (!note.trim()) {
      newErrors.note = 'A reason is required for this refund';
    }
    if (refundType === 'partial') {
      const parsed = parseFloat(partialAmount);
      if (!(parsed > 0)) {
        newErrors.amount = 'Enter an amount greater than zero';
      } else if (parsed > ceiling) {
        newErrors.amount = `Cannot exceed ${formatCurrency(ceiling)} -- the platform fee is non-refundable`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await secureApiCall(`/api/orders/${order.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          amount: refundType === 'partial' ? parseFloat(partialAmount) : undefined,
          note: note.trim(),
          restockItemIds: [...restockItemIds]
        })
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to record refund');
      }

      // The refund itself always succeeds independently of restocking --
      // a restock failure (e.g. an old order item with no variant on file)
      // shouldn't be silently swallowed just because the money side worked,
      // so it's called out here rather than left for the vendor to
      // discover as "why didn't my stock count go up".
      if (response.restockFailures?.length > 0) {
        alert(`Refund recorded, but stock could not be added back for: ${response.restockFailures.join(', ')}. Adjust that stock manually if needed.`);
      }

      await onRefundComplete?.();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to record refund' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReady = !isLoadingOrder && !loadError && fullOrder;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-100 rounded-xl">
              <Undo2 className="w-6 h-6 text-brand-800" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Refund order</h2>
              <p className="text-sm text-gray-500">{orderNumber ? `Order #${orderNumber}` : 'Loading order...'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {isLoadingOrder && (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 border-2 border-brand-800 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-gray-500">Loading order details...</p>
          </div>
        )}

        {!isLoadingOrder && loadError && (
          <div className="p-6">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {isReady && (
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Your share collected on this order</span>
              <span className="font-medium text-gray-900">{formatCurrency(ceiling)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The platform fee is non-refundable, so this is the most that can be refunded.
            </p>
          </div>

          {/* Full vs Partial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Refund amount *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRefundType('full')}
                className={`px-4 py-2.5 rounded-xl border-2 font-medium transition-colors ${
                  refundType === 'full' ? 'border-brand-800 bg-brand-50 text-brand-900' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Full refund
              </button>
              <button
                type="button"
                onClick={() => setRefundType('partial')}
                className={`px-4 py-2.5 rounded-xl border-2 font-medium transition-colors ${
                  refundType === 'partial' ? 'border-brand-800 bg-brand-50 text-brand-900' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Partial refund
              </button>
            </div>
            {refundType === 'full' ? (
              <p className="text-sm text-gray-600 mt-2">Refunding {formatCurrency(ceiling)}</p>
            ) : (
              <div className="mt-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={ceiling}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="Enter amount"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-800 focus:border-transparent text-sm ${
                    errors.amount ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
            <p className="text-xs text-gray-500 mb-2">Recorded on the order timeline and sent to you by email for your records.</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Example: Customer returned item, damaged on arrival"
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-800 focus:border-transparent text-sm ${
                errors.note ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.note && <p className="text-red-500 text-xs mt-1">{errors.note}</p>}
          </div>

          {/* Restock */}
          {items.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-gray-500" />
                Item condition
              </label>
              <div className="space-y-2">
                {items.map((item) => {
                  const isFulfilled = FULFILLED_ITEM_STATUSES.includes(item.item_status);
                  return (
                    <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${isFulfilled ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="min-w-0 pr-3">
                        <p className="text-sm text-gray-900 truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                      </div>
                      {isFulfilled ? (
                        <label className="flex items-center gap-2 text-xs text-gray-600 flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={restockItemIds.has(item.id)}
                            onChange={() => toggleRestock(item.id)}
                            className="rounded border-gray-300 text-brand-800 focus:ring-brand-800"
                          />
                          Returned &amp; sellable -- restock
                        </label>
                      ) : (
                        <span className="text-xs text-gray-400 flex-shrink-0">Not yet shipped -- released automatically</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto order-last sm:order-first px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-800 text-white rounded-xl hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Recording...
                </>
              ) : (
                'Record refund'
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
