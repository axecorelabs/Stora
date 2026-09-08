"use client";
import { Store, Phone, Mail, Clock } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import BusinessHoursEditor from "./BusinessHoursEditor";
import { DAYS_OF_WEEK, formatDayHours, hasConfiguredBusinessHours } from "@stora/shared-constants";

export default function StoreGeneralTab({ store, isEditing, editData, errors, handleChange }) {
  const hasBusinessHours = hasConfiguredBusinessHours(store.businessHours);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <SectionHeader icon={Store} title="Basic Information" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
            {isEditing ? (
              <input
                type="text"
                name="storeName"
                value={editData.storeName}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                  errors.storeName ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            ) : (
              <p className="text-gray-900 py-3">{store.storeName}</p>
            )}
            {errors.storeName && (
              <p className="text-red-500 text-xs mt-1">{errors.storeName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Type</label>
            <p className="text-gray-900 py-3 capitalize">{store.storeType}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          {isEditing ? (
            <textarea
              name="storeDescription"
              value={editData.storeDescription}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
          ) : (
            <p className="text-gray-900 py-3">{store.storeDescription || 'No description provided'}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Phone</label>
            {isEditing ? (
              <input
                type="tel"
                name="storePhone"
                value={editData.storePhone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
            ) : (
              <div className="flex items-center py-3">
                <Phone className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-gray-900">{store.storePhone || 'Not provided'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Email</label>
            {isEditing ? (
              <input
                type="email"
                name="storeEmail"
                value={editData.storeEmail}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
            ) : (
              <div className="flex items-center py-3">
                <Mail className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-gray-900">{store.storeEmail || 'Not provided'}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Business Hours</label>
          {isEditing ? (
            <BusinessHoursEditor businessHours={editData.businessHours} handleChange={handleChange} />
          ) : (
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden">
              {DAYS_OF_WEEK.map(({ key, label }) => {
                const hours = formatDayHours(store.businessHours?.[key]);
                return (
                  <div key={key} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">{label}</span>
                    <span className={`text-sm ${hours ? 'text-gray-900' : 'text-gray-400'}`}>
                      {hours || 'Not set'}
                    </span>
                  </div>
                );
              })}
              {!hasBusinessHours && (
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  Not set yet -- click Edit to add your hours.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
