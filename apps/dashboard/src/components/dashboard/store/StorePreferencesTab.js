"use client";
import { Settings, DollarSign, Loader2 } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";

export default function StorePreferencesTab({ store, isEditing, editData, handleChange, onRestaurantModeChange, isUpdatingRestaurantMode }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <SectionHeader icon={Settings} title="Store Preferences" tone="gold" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            {/* All payments settle in NGN through Paystack, so this isn't a real
                choice -- shown as a fixed fact, not an editable preference. */}
            <div className="flex items-center py-3">
              <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
              <span className="text-gray-900">Nigerian Naira (₦)</span>
            </div>
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

        {/* Immediate PATCH on toggle, same as fulfillment method's own
            break from the batched edit-mode pattern -- a binary on/off
            preference doesn't need a Save step. */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              Restaurant Mode
              {isUpdatingRestaurantMode && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
            </h3>
            <p className="text-sm text-gray-500">
              Turns on a menu-first item form and a menu-style layout for shoppers. Doesn&apos;t restrict what else you can sell.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
            <input
              type="checkbox"
              checked={!!store.restaurantMode}
              disabled={isUpdatingRestaurantMode}
              onChange={(e) => onRestaurantModeChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
