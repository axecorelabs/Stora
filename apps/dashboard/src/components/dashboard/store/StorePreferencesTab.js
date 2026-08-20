"use client";
import { Settings, DollarSign } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function StorePreferencesTab({ store, isEditing, editData, handleChange, currencyOptions }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <SectionHeader icon={Settings} title="Store Preferences" tone="gold" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            {isEditing ? (
              <CustomDropdown
                options={currencyOptions}
                value={editData.settings.currency}
                onChange={(value) => handleChange({ target: { name: 'settings.currency', value } })}
                placeholder="Select currency"
              />
            ) : (
              <div className="flex items-center py-3">
                <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-gray-900">{currencyOptions.find(opt => opt.value === store.settings.currency)?.label || store.settings.currency}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Tax Rate (%)</label>
            {isEditing ? (
              <input
                type="number"
                name="settings.taxRate"
                value={editData.settings.taxRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
            ) : (
              <p className="text-gray-900 py-3">{store.settings.taxRate}%</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Footer Message</label>
          {isEditing ? (
            <input
              type="text"
              name="settings.receiptFooter"
              value={editData.settings.receiptFooter}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
          ) : (
            <p className="text-gray-900 py-3">{store.settings.receiptFooter}</p>
          )}
        </div>
      </div>
    </div>
  );
}
