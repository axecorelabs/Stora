"use client";
import { MapPin, QrCode } from "lucide-react";

export default function InventoryAdditionalInfo({ item }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
          <p className="text-gray-900">{item.unitOfMeasure}</p>
        </div>
        {item.supplier && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <p className="text-gray-900">{item.supplier}</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
          <div className="flex items-center text-gray-900">
            <MapPin className="w-4 h-4 mr-1 text-gray-500" />
            {item.location}
          </div>
        </div>
        {item.qrCode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">QR Code</label>
            <div className="flex items-center text-gray-900">
              <QrCode className="w-4 h-4 mr-1 text-gray-500" />
              {item.qrCode}
            </div>
          </div>
        )}
        {item.notes && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <p className="text-gray-900">{item.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
