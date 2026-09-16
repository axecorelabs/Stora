"use client";

import { Info, Plus, Tag, Trash2 } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";

function normalizePriceList(raw) {
  if (!raw) return [];
  const source = Array.isArray(raw) ? raw : Array.isArray(raw.items) ? raw.items : [];

  return source
    .map((item) => {
      if (!item) return null;

      if (typeof item === "string") {
        return { title: item.trim(), price: "", from: false, note: "" };
      }

      const title = (item.title || item.name || item.label || "").trim();
      if (!title) return null;

      const rawPrice = item.price ?? item.amount ?? item.value ?? item.minPrice;
      const cleaned = rawPrice === null || rawPrice === undefined || rawPrice === ""
        ? ""
        : String(rawPrice).replace(/[^\d.-]/g, "");

      return {
        title,
        price: cleaned,
        from: Boolean(item.from || item.isFrom || item.minPrice),
        note: (item.note || "").trim()
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Ask for price";

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numeric);
}

export default function StoreServicesTab({ store, isEditing, editData, setPriceList, errors = {} }) {
  const readList = normalizePriceList(store?.onlineStoreInfo?.priceList);
  const editList = editData?.onlineStoreInfo?.priceList || [];
  const lastUpdated = isEditing
    ? editData?.onlineStoreInfo?.priceListUpdatedAt
    : store?.onlineStoreInfo?.priceListUpdatedAt;

  const updateItem = (index, key, value) => {
    const next = editList.map((item, idx) => (idx === index ? { ...item, [key]: value } : item));
    setPriceList(next);
  };

  const addItem = () => {
    setPriceList([...editList, { title: "", price: "", from: false, note: "" }]);
  };

  const removeItem = (index) => {
    setPriceList(editList.filter((_, idx) => idx !== index));
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <SectionHeader icon={Tag} title="Services and Price List" />

      <p className="text-sm text-gray-500 mb-5">
        Add the services you offer and your pricing. This is shown on your public business showcase.
      </p>

      {!isEditing && readList.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
          <p className="text-sm font-medium text-gray-700">No services added yet</p>
          <p className="text-xs text-gray-500 mt-1">Use Edit Store then the Services tab to add your first service and price.</p>
        </div>
      )}

      {!isEditing && readList.length > 0 && (
        <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
          {readList.map((item, idx) => (
            <div key={`${item.title}-${idx}`} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-800">{item.title}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {item.from ? `From ${formatPrice(item.price)}` : formatPrice(item.price)}
                </p>
              </div>
              {item.note && <p className="text-xs text-gray-500 mt-1">{item.note}</p>}
            </div>
          ))}
        </div>
      )}

      {isEditing && (
        <div className="space-y-4">
          {editList.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500">
              No services added yet. Click “Add service” to begin.
            </div>
          )}

          {editList.map((item, idx) => (
            <div key={`service-${idx}`} className="rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Service</label>
                  <input
                    type="text"
                    value={item.title || ""}
                    onChange={(e) => updateItem(idx, "title", e.target.value)}
                    placeholder="e.g. Bridal makeover"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Price (NGN)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.price || ""}
                    onChange={(e) => updateItem(idx, "price", e.target.value)}
                    placeholder="5000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(item.from)}
                    onChange={(e) => updateItem(idx, "from", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-800 focus:ring-brand-800"
                  />
                  Mark as "From" price
                  <span className="relative inline-flex items-center group">
                    <Info className="w-3.5 h-3.5 text-gray-400" />
                    <span className="pointer-events-none absolute left-1/2 top-[125%] z-10 hidden w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-2 text-xs font-normal leading-snug text-white shadow-lg group-hover:block">
                      Use this when the amount is a starting price. It will display as "From NGN" and may increase based on scope or add-ons.
                    </span>
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>

              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Short note (optional)</label>
                <input
                  type="text"
                  value={item.note || ""}
                  onChange={(e) => updateItem(idx, "note", e.target.value)}
                  placeholder="e.g. Includes consultation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
          >
            <Plus className="w-4 h-4" />
            Add service
          </button>

          {errors["onlineStoreInfo.priceList"] && (
            <p className="text-red-500 text-xs">{errors["onlineStoreInfo.priceList"]}</p>
          )}
        </div>
      )}

      {lastUpdated && (
        <p className="text-xs text-gray-400 mt-4">
          Last updated {new Date(lastUpdated).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}
        </p>
      )}
    </div>
  );
}
