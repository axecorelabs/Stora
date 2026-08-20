"use client";
import { Truck, AlertCircle } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import StateMultiSelect from "@/components/dashboard/StateMultiSelect";

export default function StoreDeliveryTab({ store, isEditing, editData, errors, setDeliveryNationwide, toggleDeliveryState }) {
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
    </div>
  );
}
