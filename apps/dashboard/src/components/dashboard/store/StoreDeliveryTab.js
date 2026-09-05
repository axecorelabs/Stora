"use client";
import { useState } from "react";
import { Truck, AlertCircle, Loader2 } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import StateMultiSelect from "@/components/dashboard/StateMultiSelect";
import { NG_ZONES, STATE_TO_ZONE, NIGERIAN_STATES } from "@stora/shared-constants";

const STATE_LABEL = Object.fromEntries(NIGERIAN_STATES.map((s) => [s.value, s.label]));

export default function StoreDeliveryTab({
  store,
  isEditing,
  editData,
  errors,
  setDeliveryNationwide,
  toggleDeliveryState,
  setDeliveryFee,
  setDeliveryFeeForZone,
  onFulfillmentMethodChange,
  isUpdatingFulfillmentMethod,
  // See StorePreferencesTab.js's identical prop -- skips this instant-save
  // section inside EditStoreModal, which only handles batched fields.
  hideInstantToggles = false
}) {
  const [zoneInputs, setZoneInputs] = useState({});

  // Only the states this vendor actually delivers to need a fee input --
  // all 37 if nationwide, else just the ones selected above. Shrinking
  // that selection just hides a fee row, it doesn't delete the stored
  // value, so re-adding a state later restores its old price.
  const feeStates = editData.deliveryNationwide
    ? NIGERIAN_STATES.map((s) => s.value)
    : (editData.deliveryStates || []);

  // A state with no fee entry isn't "free delivery" -- checkout tells the
  // customer their fee will be confirmed directly with the vendor instead.
  // Surfaced here so a vendor notices before a customer does. Computed from
  // editData while editing (feeStates above already reads editData too) but
  // from store directly for the read-only view below -- editData resets to
  // {} outside edit mode (see cancelEditing in the parent page), so reusing
  // feeStates there would silently show zero unset states regardless of the
  // real data.
  const unsetFeeStates = feeStates.filter((s) => {
    const value = editData.deliveryFees?.[s];
    return value === undefined || value === null || value === '';
  });
  const readOnlyFeeStates = store.deliveryNationwide
    ? NIGERIAN_STATES.map((s) => s.value)
    : (store.deliveryStates || []);
  const readOnlyUnsetFeeStates = readOnlyFeeStates.filter((s) => {
    const value = store.deliveryFees?.[s];
    return value === undefined || value === null || value === '';
  });

  const applyZoneFee = (zone) => {
    const amount = Number(zoneInputs[zone]);
    if (!Number.isFinite(amount) || amount < 0) return;
    const statesInZone = feeStates.filter((s) => STATE_TO_ZONE[s] === zone);
    setDeliveryFeeForZone(statesInZone, amount);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <SectionHeader icon={Truck} title="Delivery Regions" />
      <p className="text-xs text-gray-500 mb-6">
        Which states you&apos;ll ship to. Buyers outside this list won&apos;t be able to check out with you.
      </p>

      {isEditing ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeliveryNationwide(true)}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                editData.deliveryNationwide
                  ? 'bg-brand-800 border-brand-800 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Nationwide
            </button>
            <button
              type="button"
              onClick={() => setDeliveryNationwide(false)}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                !editData.deliveryNationwide
                  ? 'bg-brand-800 border-brand-800 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Specific states
            </button>
          </div>

          {!editData.deliveryNationwide && (
            <StateMultiSelect value={editData.deliveryStates || []} onChange={toggleDeliveryState} />
          )}

          {errors.deliveryStates && (
            <p className="text-red-500 text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.deliveryStates}
            </p>
          )}
        </div>
      ) : (
        <p className="text-gray-900 py-1">
          {store.deliveryNationwide
            ? 'Nationwide'
            : (store.deliveryStates || []).join(', ')}
        </p>
      )}

      {/* Delivery fee -- flat amount per destination state. Only shown once
          there's at least one deliverable state to price. */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Delivery fee</h3>
        <p className="text-xs text-gray-500 mb-4">
          A flat fee per state, charged to the customer at checkout.
        </p>

        {isEditing && unsetFeeStates.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              {unsetFeeStates.length} state{unsetFeeStates.length !== 1 ? 's' : ''} below {unsetFeeStates.length !== 1 ? "don't" : "doesn't"} have a fee yet.
              Customers there will be told delivery isn&apos;t free and to expect the fee to be confirmed with you directly, rather than seeing a price.
              Set a fee (or 0 for genuinely free delivery) to charge it automatically instead.
            </span>
          </p>
        )}

        {isEditing ? (
          feeStates.length === 0 ? (
            <p className="text-sm text-gray-400">Select at least one delivery state above first.</p>
          ) : (
            <div className="space-y-4">
              {/* Bulk-set by zone -- fills every state in that zone that
                  doesn't already have an explicit fee, never overwrites one
                  that does. A data-entry shortcut over 37 individual
                  inputs, not a separate concept from the per-state list
                  below -- both write to the same editData.deliveryFees. */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Bulk-set by zone</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {NG_ZONES.map((zone) => (
                    <div key={zone} className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1.5">
                      <span className="text-xs text-gray-600 flex-1 min-w-0 truncate" title={zone}>{zone}</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        placeholder="₦"
                        value={zoneInputs[zone] ?? ''}
                        onChange={(e) => setZoneInputs((prev) => ({ ...prev, [zone]: e.target.value }))}
                        onBlur={() => applyZoneFee(zone)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            applyZoneFee(zone);
                          }
                        }}
                        className="w-16 px-1.5 py-1 border border-gray-200 rounded text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
                {feeStates.map((state) => {
                  const isUnset = unsetFeeStates.includes(state);
                  return (
                    <div key={state} className="flex items-center justify-between gap-3 py-1">
                      <span className="text-sm text-gray-700 flex items-center gap-1.5">
                        {STATE_LABEL[state] || state}
                        {isUnset && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Not set</span>}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-sm text-gray-400">₦</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          placeholder="Not set"
                          value={editData.deliveryFees?.[state] ?? ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? undefined : Number(e.target.value);
                            setDeliveryFee(state, value);
                          }}
                          className={`w-24 px-2.5 py-1.5 border rounded-lg text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-brand-600 ${
                            isUnset ? 'border-amber-300 bg-amber-50/50' : 'border-gray-300'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div className="py-1 space-y-2">
            <p className="text-gray-900 text-sm">
              {Object.keys(store.deliveryFees || {}).length === 0
                ? 'No delivery fees set'
                : Object.entries(store.deliveryFees)
                    .map(([state, fee]) => `${STATE_LABEL[state] || state}: ₦${Number(fee).toLocaleString('en-NG')}`)
                    .join(', ')}
            </p>
            {readOnlyUnsetFeeStates.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  No fee set for {readOnlyUnsetFeeStates.map((s) => STATE_LABEL[s] || s).join(', ')}. Customers ordering delivery there will be told the fee is confirmed with you directly, not free.
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Fulfillment method -- fires immediately, same pattern as the
          commission-bearer toggle on the Payments page: a binary choice
          with an instantly-understood effect doesn't need a batched Save.
          Skipped inside EditStoreModal -- see hideInstantToggles above. */}
      {!hideInstantToggles && (
        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900">Who collects the delivery fee?</h3>
            {isUpdatingFulfillmentMethod && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Only affects orders placed after you change this.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onFulfillmentMethodChange('platform_collected')}
              disabled={isUpdatingFulfillmentMethod || !store.bankDetails?.paystack_subaccount_code}
              className={`text-left p-3 lg:p-4 rounded-xl border-2 transition-colors disabled:opacity-60 ${
                store.fulfillmentMethod === 'platform_collected'
                  ? 'border-brand-800 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">Stora collects it (Default)</p>
              <p className="text-xs text-gray-500 mt-1">
                {store.bankDetails?.paystack_subaccount_code
                  ? 'Charged through Paystack at checkout, same payment as the order itself.'
                  : 'Set up payouts first to use this option.'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onFulfillmentMethodChange('pay_on_delivery')}
              disabled={isUpdatingFulfillmentMethod}
              className={`text-left p-3 lg:p-4 rounded-xl border-2 transition-colors disabled:opacity-60 ${
                store.fulfillmentMethod === 'pay_on_delivery'
                  ? 'border-brand-800 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">Your rider collects it</p>
              <p className="text-xs text-gray-500 mt-1">
                Customer pays the delivery fee in cash/transfer when your order arrives. Item cost is still paid through Stora as normal.
              </p>
            </button>
          </div>
          {errors.fulfillmentMethod && (
            <p className="text-red-500 text-xs flex items-center gap-1 mt-2">
              <AlertCircle className="w-3 h-3" />
              {errors.fulfillmentMethod}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
