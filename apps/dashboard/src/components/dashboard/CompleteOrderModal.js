"use client";
import { useState, useEffect } from "react";
import { X, PackageCheck, Banknote, Landmark, CreditCard, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { mapToOrderPaymentMethod } from "@/lib/paymentMethod";
import ReceiptModal from "./ReceiptModal";

const formatCurrency = (amount) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0
}).format(amount || 0);

// Mirrors POS's own three-way payment picker (pos/page.js) -- same short,
// one-word labels (not "Bank Transfer"/"Card (POS machine)"), since POS
// uses those specifically so three fit per row without wrapping in a
// narrow modal on a phone -- mapped to order_payments' real enum values via
// the shared helper, not POS's raw (and previously broken -- see
// paymentMethod.js) UI strings.
const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'transfer', label: 'Transfer', icon: Landmark },
  { value: 'pos', label: 'Card', icon: CreditCard }
];

// Fast, one-page alternative to Start/Continue Processing -> POS (which
// stays exactly as it is, for whoever wants to edit the cart during
// fulfillment -- see OrderDetailsContent.js). This flow never touches the
// cart: it completes the order exactly as placed, collects how it was paid
// only when that isn't already on file, and shows a receipt immediately.
//
// Same wiring pattern as RefundModal.js (mounted alongside it in
// OrderDetailsContent.js): fetches the canonical order itself on open
// rather than trusting the caller's possibly-lighter shape, and posts
// directly rather than through the generic status-update mutation, since
// it needs the sale data that mutation's own plumbing doesn't carry back.
export default function CompleteOrderModal({ isOpen, onClose, order, onCompleted }) {
  const { secureApiCall } = useAuth();
  const [fullOrder, setFullOrder] = useState(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [completedSale, setCompletedSale] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedMethod(null);
      setSubmitError('');
      setCompletedSale(null);
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

  // The receipt takes over the screen once the order is completed -- keep
  // it rendered even after the rest of this modal's isOpen/order guard
  // below would otherwise unmount everything.
  if (completedSale) {
    return (
      <ReceiptModal
        isOpen={true}
        onClose={() => { setCompletedSale(null); onClose(); }}
        sale={completedSale}
      />
    );
  }

  if (!isOpen || !order) return null;

  const items = fullOrder?.items || [];
  const orderNumber = fullOrder?.orderNumber || order.orderNumber || '';
  const existingPaymentMethod = fullOrder?.paymentInfo?.method || null;
  const total = fullOrder?.totalAmount ?? 0;

  const handleSubmit = async () => {
    const paymentMethod = existingPaymentMethod || mapToOrderPaymentMethod(selectedMethod);

    if (!existingPaymentMethod && !paymentMethod) {
      setSubmitError('Choose how this order was paid for');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);
    try {
      const response = await secureApiCall(`/api/orders/${order.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'delivered',
          note: 'Completed via one-page order completion',
          updatedBy: 'admin',
          ...(existingPaymentMethod ? {} : { paymentMethod })
        })
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to complete order');
      }

      onCompleted?.();

      if (response.sale) {
        setCompletedSale(response.sale);
      } else {
        onClose();
      }
    } catch (error) {
      setSubmitError(error.message || 'Failed to complete order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-100 text-brand-800 shrink-0">
              <PackageCheck className="w-4.5 h-4.5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Complete Order</h3>
              {orderNumber && <p className="text-xs text-gray-500">#{orderNumber}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isLoadingOrder ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading order…</div>
          ) : loadError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {loadError}
            </div>
          ) : (
            <>
              <div className="mb-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={item.id || index} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-700 min-w-0 truncate">
                        {item.quantity}× {item.productSnapshot?.productName || 'Item'}
                      </span>
                      <span className="text-gray-900 font-medium shrink-0">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-gray-900 mt-3 pt-3 border-t border-gray-100">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Payment</p>
                {existingPaymentMethod ? (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
                    Already paid ({existingPaymentMethod.replace(/_/g, ' ')})
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelectedMethod(value)}
                        className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 text-xs font-medium transition-colors ${
                          selectedMethod === value
                            ? 'border-brand-800 bg-brand-50 text-brand-800'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-4.5 h-4.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {submitError && (
                <p className="text-red-500 text-xs flex items-center gap-1 mt-4">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {submitError}
                </p>
              )}
            </>
          )}
        </div>

        {!isLoadingOrder && !loadError && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 p-6 border-t border-gray-200 shrink-0">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto order-last sm:order-first px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-800 text-white rounded-xl hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSubmitting ? 'Completing…' : 'Complete Order'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
