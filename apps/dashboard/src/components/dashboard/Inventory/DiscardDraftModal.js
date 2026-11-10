"use client";
import { AlertTriangle } from "lucide-react";

// Shared by: the resume-prompt's "Discard" action, and the main Cancel
// button / backdrop-click once there's anything non-trivial to lose.
// z-[60] -- one above AddInventoryModal's own z-50 backdrop, since this
// can appear stacked on top of it.
export default function DiscardDraftModal({ productName, imageCount, onKeepEditing, onDiscard }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-xl flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Discard this product?</h3>
            <p className="text-sm text-gray-500 mt-1">
              {productName ? `"${productName}"` : 'This unsaved product'}
              {imageCount > 0 && ` and ${imageCount} image${imageCount === 1 ? '' : 's'}`} will be lost for good.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onKeepEditing}
            className="w-full sm:w-auto order-last sm:order-first px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="w-full sm:w-auto px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Discard draft
          </button>
        </div>
      </div>
    </div>
  );
}
