"use client";
import { useState, useEffect } from "react";
import { Truck, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import StoreDeliveryTab from "@/components/dashboard/store/StoreDeliveryTab";

// Same delivery states/fees/fulfillment-method settings as Store Settings'
// Delivery tab (apps/dashboard/src/app/dashboard/store/page.js), surfaced
// here too since this is the page a vendor actually checks day-to-day --
// "buried in a different page's specific tab" is exactly the discoverability
// gap this closes. Deliberately duplicates that page's small handler
// functions rather than extracting a shared hook: store/page.js's version
// is tightly coupled to its own page-wide isEditing/Save lifecycle, and
// refactoring working code purely to share ~25 lines with one new consumer
// is a worse trade than a little duplication. StoreDeliveryTab itself is
// reused completely unmodified -- it was already self-contained.
export default function DeliverySettingsCard() {
  const { secureApiCall } = useAuth();
  const [store, setStore] = useState(null);
  const [editData, setEditData] = useState(null);
  const [errors, setErrors] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingFulfillmentMethod, setIsUpdatingFulfillmentMethod] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await secureApiCall('/api/stores');
      if (cancelled || !response.success || !response.data) return;
      setStore(response.data);
      setEditData({
        deliveryNationwide: response.data.deliveryNationwide,
        deliveryStates: response.data.deliveryStates || [],
        deliveryFees: response.data.deliveryFees || {}
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!store || !editData) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 lg:mb-6 animate-pulse">
        <div className="h-5 w-40 bg-gray-100 rounded"></div>
      </div>
    );
  }

  const isDirty = editData.deliveryNationwide !== store.deliveryNationwide
    || JSON.stringify(editData.deliveryStates || []) !== JSON.stringify(store.deliveryStates || [])
    || JSON.stringify(editData.deliveryFees || {}) !== JSON.stringify(store.deliveryFees || {});

  const summary = editData.deliveryNationwide
    ? 'Nationwide'
    : `${(editData.deliveryStates || []).length} state${(editData.deliveryStates || []).length === 1 ? '' : 's'} configured`;
  const methodSummary = store.fulfillmentMethod === 'pay_on_delivery' ? 'Your rider collects fees' : 'Stora collects fees';

  const setDeliveryNationwide = (nationwide) => {
    setEditData(prev => ({ ...prev, deliveryNationwide: nationwide }));
    if (errors.deliveryStates) setErrors(prev => ({ ...prev, deliveryStates: '' }));
  };

  const toggleDeliveryState = (states) => {
    setEditData(prev => ({ ...prev, deliveryStates: states }));
    if (errors.deliveryStates) setErrors(prev => ({ ...prev, deliveryStates: '' }));
  };

  const setDeliveryFee = (state, amount) => {
    setEditData(prev => ({ ...prev, deliveryFees: { ...prev.deliveryFees, [state]: amount } }));
  };

  const setDeliveryFeeForZone = (statesInZone, amount) => {
    setEditData(prev => {
      const nextFees = { ...prev.deliveryFees };
      for (const state of statesInZone) {
        if (nextFees[state] === undefined) nextFees[state] = amount;
      }
      return { ...prev, deliveryFees: nextFees };
    });
  };

  const handleFulfillmentMethodChange = async (fulfillmentMethod) => {
    if (fulfillmentMethod === store.fulfillmentMethod || isUpdatingFulfillmentMethod) return;
    setIsUpdatingFulfillmentMethod(true);
    try {
      const response = await secureApiCall('/api/stores/fulfillment-method', {
        method: 'PATCH',
        body: JSON.stringify({ fulfillmentMethod })
      });
      if (response.success) {
        setStore(prev => ({ ...prev, fulfillmentMethod: response.data.fulfillmentMethod }));
      } else {
        setErrors(prev => ({ ...prev, fulfillmentMethod: response.message || 'Failed to update' }));
      }
    } finally {
      setIsUpdatingFulfillmentMethod(false);
    }
  };

  const handleSave = async () => {
    if (!editData.deliveryNationwide && (editData.deliveryStates || []).length === 0) {
      setErrors(prev => ({ ...prev, deliveryStates: 'Select at least one state, or choose Nationwide' }));
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await secureApiCall('/api/stores', {
        method: 'PUT',
        body: JSON.stringify({
          deliveryStates: editData.deliveryNationwide ? null : editData.deliveryStates,
          deliveryFees: editData.deliveryFees || {}
        })
      });
      if (response.success) {
        setStore(response.data);
        setEditData({
          deliveryNationwide: response.data.deliveryNationwide,
          deliveryStates: response.data.deliveryStates || [],
          deliveryFees: response.data.deliveryFees || {}
        });
        setErrors({});
      } else {
        setSaveError(response.message || 'Failed to save delivery settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 mb-4 lg:mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 lg:p-5 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-100 text-brand-800 flex-shrink-0">
            <Truck className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">Delivery Settings</p>
            <p className="text-xs text-gray-500 truncate">{summary} · {methodSummary}</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 p-4 lg:p-5">
          <StoreDeliveryTab
            store={store}
            isEditing={true}
            editData={editData}
            errors={errors}
            setDeliveryNationwide={setDeliveryNationwide}
            toggleDeliveryState={toggleDeliveryState}
            setDeliveryFee={setDeliveryFee}
            setDeliveryFeeForZone={setDeliveryFeeForZone}
            onFulfillmentMethodChange={handleFulfillmentMethodChange}
            isUpdatingFulfillmentMethod={isUpdatingFulfillmentMethod}
          />

          {saveError && (
            <p className="text-red-500 text-xs mt-3">{saveError}</p>
          )}

          {isDirty && (
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-900 transition-colors disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save delivery settings'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
