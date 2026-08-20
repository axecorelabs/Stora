"use client";
import { Store, Phone, Mail } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";

export default function StoreGeneralTab({ store, isEditing, editData, errors, handleChange }) {
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
      </div>
    </div>
  );
}
