"use client";
import { MapPin, Globe, Instagram, MessageCircle } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function StoreLocationTab({ store, isEditing, editData, errors, handleChange, nigerianStates }) {
  if (store.storeType === 'physical') {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <SectionHeader icon={MapPin} title="Location Information" />

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
            {isEditing ? (
              <input
                type="text"
                name="address.street"
                value={editData.address.street}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
            ) : (
              <p className="text-gray-900 py-3">{store.address.street || 'Not provided'}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              {isEditing ? (
                <input
                  type="text"
                  name="address.city"
                  value={editData.address.city}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                    errors['address.city'] ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
              ) : (
                <p className="text-gray-900 py-3">{store.address.city}</p>
              )}
              {errors['address.city'] && (
                <p className="text-red-500 text-xs mt-1">{errors['address.city']}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              {isEditing && (
                <p className="text-xs text-gray-500 mb-2">
                  Shown to buyers so they can find vendors closer to them.
                </p>
              )}
              {isEditing ? (
                <CustomDropdown
                  options={nigerianStates}
                  value={editData.address.state}
                  onChange={(value) => handleChange({ target: { name: 'address.state', value } })}
                  placeholder="Select state"
                  error={!!errors['address.state']}
                />
              ) : (
                <p className="text-gray-900 py-3">{store.address.state}</p>
              )}
              {errors['address.state'] && (
                <p className="text-red-500 text-xs mt-1">{errors['address.state']}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <p className="text-gray-900 py-3">{store.address.country}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
              {isEditing ? (
                <input
                  type="text"
                  name="address.postalCode"
                  value={editData.address.postalCode}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                />
              ) : (
                <p className="text-gray-900 py-3">{store.address.postalCode || 'Not provided'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <SectionHeader icon={Globe} title="Online Presence" />

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Main Operating State</label>
          <p className="text-xs text-gray-500 mb-2">
            Where you&apos;re based -- shown to buyers so they can find vendors closer to them.
          </p>
          {isEditing ? (
            <CustomDropdown
              options={nigerianStates}
              value={editData.state}
              onChange={(value) => handleChange({ target: { name: 'state', value } })}
              placeholder="Select state"
            />
          ) : (
            <p className="text-gray-900 py-3">{store.state || 'Not set'}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Instagram Handle</label>
            {isEditing ? (
              <input
                type="text"
                name="onlineStoreInfo.socialMedia.instagram"
                value={editData.onlineStoreInfo.socialMedia.instagram}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
            ) : (
              <div className="flex items-center py-3">
                <Instagram className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-gray-900">{store.onlineStoreInfo?.socialMedia?.instagram || 'Not provided'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Number</label>
            {isEditing ? (
              <input
                type="tel"
                name="onlineStoreInfo.socialMedia.whatsapp"
                value={editData.onlineStoreInfo.socialMedia.whatsapp}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
            ) : (
              <div className="flex items-center py-3">
                <MessageCircle className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-gray-900">{store.onlineStoreInfo?.socialMedia?.whatsapp || 'Not provided'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
