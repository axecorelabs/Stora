"use client";
import { useEffect, useState } from "react";
import { Settings, DollarSign, Loader2 } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import CustomDropdown from "@/components/ui/CustomDropdown";
import {
  BUSINESS_CATEGORY_VALUES,
  BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY,
  BUSINESS_SUBCATEGORY_COMBOS_BY_CATEGORY
} from "@stora/shared-constants";

// A store must always do at least one of Products/Food/Services (same rule
// CreateBusinessModal enforces at creation) -- disables whichever toggle
// would be the last one left on, rather than letting the request go out
// and fail server-side (PUT /api/stores and PATCH .../restaurant-mode both
// also enforce this, since this is a UI nicety, not the real guarantee).
function isLastBusinessType(store, field) {
  const types = { sellsProducts: !!store.sellsProducts, offersServices: !!store.offersServices, restaurantMode: !!store.restaurantMode };
  return types[field] && Object.entries(types).filter(([k, v]) => k !== field && v).length === 0;
}

export default function StorePreferencesTab({
  store, isEditing, editData, handleChange, errors = {},
  onTemporarilyClosedChange, isUpdatingTemporarilyClosed,
  onRestaurantModeChange, isUpdatingRestaurantMode,
  onSellsProductsChange, isUpdatingSellsProducts,
  onOffersServicesChange, isUpdatingOffersServices,
  onBusinessCategoryChange, isUpdatingBusinessCategory,
  onBusinessSubcategoryChange, isUpdatingBusinessSubcategory,
  isUpdatingBusinessSubcategories,
  // Skips the instant-toggle section entirely -- used inside EditStoreModal,
  // which only handles batched fields (Save/Cancel); the toggles below
  // save immediately and always live on the main Store page instead, so
  // rendering them a second time inside the modal would just be a
  // confusing duplicate control for the same live value.
  hideInstantToggles = false
}) {
  const [subcategoryDraft, setSubcategoryDraft] = useState(store.businessSubcategory || '');
  const [subcategoriesDraft, setSubcategoriesDraft] = useState(
    (Array.isArray(store.businessSubcategories) ? store.businessSubcategories : [])
      .filter((entry) => entry !== store.businessSubcategory)
  );

  useEffect(() => {
    setSubcategoryDraft(store.businessSubcategory || '');
    const secondary = (Array.isArray(store.businessSubcategories) ? store.businessSubcategories : [])
      .filter((entry) => entry !== store.businessSubcategory);
    setSubcategoriesDraft(secondary);
  }, [store.businessSubcategory, store.businessSubcategories]);

  const businessCategoryOptions = BUSINESS_CATEGORY_VALUES.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1)
  }));

  const selectedCategory = isEditing ? editData.businessCategory : store.businessCategory;
  const activeSubcategoryOptions = BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY[selectedCategory] || [];
  const activeSubcategoryCombos = BUSINESS_SUBCATEGORY_COMBOS_BY_CATEGORY[selectedCategory] || [];
  const primarySubcategoryOptions = [{ value: '', label: 'Select primary subcategory' }, ...activeSubcategoryOptions];

  const toggleDraftSubcategory = (value) => {
    if (!value || value === subcategoryDraft) return;
    setSubcategoriesDraft((prev) => prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]);
  };

  const toggleEditSubcategory = (value) => {
    if (!value || value === editData.businessSubcategory) return;
    const current = Array.isArray(editData.businessSubcategories) ? editData.businessSubcategories : [];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    handleChange({ target: { name: 'businessSubcategories', value: next } });
  };

  const applyDraftCombo = (combo) => {
    if (!combo) return;
    setSubcategoryDraft(combo.primary || '');
    setSubcategoriesDraft((combo.secondary || []).filter((entry) => entry !== combo.primary));
  };

  const applyEditCombo = (combo) => {
    if (!combo) return;
    handleChange({ target: { name: 'businessSubcategory', value: combo.primary || '' } });
    handleChange({
      target: {
        name: 'businessSubcategories',
        value: (combo.secondary || []).filter((entry) => entry !== combo.primary)
      }
    });
  };

  const currentSecondary = (Array.isArray(store.businessSubcategories) ? store.businessSubcategories : [])
    .filter((entry) => entry !== store.businessSubcategory);
  const hasSubcategoryChanges = (subcategoryDraft || '') !== (store.businessSubcategory || '')
    || JSON.stringify(subcategoriesDraft) !== JSON.stringify(currentSecondary);

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

        <div className="pt-2 border-t border-gray-100 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Business classification</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Business Category</label>
            {isEditing ? (
              <CustomDropdown
                options={businessCategoryOptions}
                value={editData.businessCategory}
                onChange={(value) => handleChange({ target: { name: 'businessCategory', value } })}
                placeholder="Select business category"
              />
            ) : (
              <CustomDropdown
                options={businessCategoryOptions}
                value={store.businessCategory || ''}
                onChange={(value) => onBusinessCategoryChange?.(value)}
                placeholder="Select business category"
              />
            )}
            {errors.businessCategory && (
              <p className="text-red-500 text-xs mt-1">{errors.businessCategory}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Business Subcategory</label>
            {isEditing ? (
              <div className="space-y-3">
                <CustomDropdown
                  options={primarySubcategoryOptions}
                  value={editData.businessSubcategory || ''}
                  onChange={(value) => {
                    handleChange({ target: { name: 'businessSubcategory', value } });
                    const current = Array.isArray(editData.businessSubcategories) ? editData.businessSubcategories : [];
                    handleChange({
                      target: {
                        name: 'businessSubcategories',
                        value: current.filter((entry) => entry !== value)
                      }
                    });
                  }}
                  placeholder="Select primary subcategory"
                  disabled={!selectedCategory}
                />
                {selectedCategory ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {activeSubcategoryOptions
                        .filter((option) => option.value !== editData.businessSubcategory)
                        .map((option) => {
                          const selected = (editData.businessSubcategories || []).includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => toggleEditSubcategory(option.value)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                selected
                                  ? 'bg-brand-700 text-white border-brand-700'
                                  : 'bg-white text-brand-800 border-brand-200 hover:border-brand-300'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                    </div>
                    {activeSubcategoryCombos.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Suggested combinations</p>
                        <div className="flex flex-wrap gap-2">
                          {activeSubcategoryCombos.map((combo) => (
                            <button
                              key={combo.key}
                              type="button"
                              onClick={() => applyEditCombo(combo)}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-gold-300 text-gold-700 bg-gold-50 hover:bg-gold-100 transition-colors"
                            >
                              {combo.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-500">Select a business category first.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <CustomDropdown
                  options={primarySubcategoryOptions}
                  value={subcategoryDraft}
                  onChange={(value) => {
                    setSubcategoryDraft(value);
                    setSubcategoriesDraft((prev) => prev.filter((entry) => entry !== value));
                  }}
                  placeholder="Select primary subcategory"
                  disabled={!selectedCategory}
                />
                {selectedCategory ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {activeSubcategoryOptions
                        .filter((option) => option.value !== subcategoryDraft)
                        .map((option) => {
                          const selected = subcategoriesDraft.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => toggleDraftSubcategory(option.value)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                selected
                                  ? 'bg-brand-700 text-white border-brand-700'
                                  : 'bg-white text-brand-800 border-brand-200 hover:border-brand-300'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                    </div>
                    {activeSubcategoryCombos.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Suggested combinations</p>
                        <div className="flex flex-wrap gap-2">
                          {activeSubcategoryCombos.map((combo) => (
                            <button
                              key={combo.key}
                              type="button"
                              onClick={() => applyDraftCombo(combo)}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-gold-300 text-gold-700 bg-gold-50 hover:bg-gold-100 transition-colors"
                            >
                              {combo.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-500">Select a business category first.</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!hasSubcategoryChanges || !!isUpdatingBusinessSubcategory || !!isUpdatingBusinessSubcategories}
                    onClick={() => onBusinessSubcategoryChange?.(subcategoryDraft.trim(), subcategoriesDraft)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-200 text-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(isUpdatingBusinessSubcategory || isUpdatingBusinessSubcategories) ? 'Saving...' : 'Save subcategories'}
                  </button>
                </div>
              </div>
            )}
            {errors.businessSubcategory && (
              <p className="text-red-500 text-xs mt-1">{errors.businessSubcategory}</p>
            )}
          </div>

          {!isEditing && isUpdatingBusinessCategory && (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Updating business category...
            </p>
          )}
        </div>

        {/* Manual "closed right now" override -- separate from the weekly
            hours schedule (Store > General > Business Hours), which can
            only ever describe a recurring pattern, not an unexpected
            closure. Same instant-toggle contract as everything below: no
            Save step, takes effect immediately. */}
        {!hideInstantToggles && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  Temporarily Closed
                  {isUpdatingTemporarilyClosed && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
                </h4>
                <p className="text-sm text-gray-500">
                  Shows as closed to shoppers right now, regardless of your regular hours -- use this for an unexpected closure.
                </p>
                {errors.temporarilyClosed && (
                  <p className="text-red-500 text-xs mt-1">{errors.temporarilyClosed}</p>
                )}
              </div>
              <label className={`relative inline-flex items-center shrink-0 ml-4 ${isUpdatingTemporarilyClosed ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={!!store.temporarilyClosed}
                  disabled={isUpdatingTemporarilyClosed}
                  onChange={(e) => onTemporarilyClosedChange?.(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-disabled:opacity-50"></div>
              </label>
            </div>
          </div>
        )}

        {/* Immediate PATCH/PUT on toggle, no Save step -- each of these is a
            binary on/off preference with an instantly-understood effect,
            same reasoning as fulfillment method's own break from the
            batched edit-mode pattern below. A store must keep at least one
            on (the same rule CreateBusinessModal enforces at creation), so
            whichever one is currently the last active type is disabled. */}
        {!hideInstantToggles && (
          <div className="pt-2 border-t border-gray-100 space-y-5">
            <h3 className="text-sm font-semibold text-gray-900">What does your business do?</h3>
            {[
              {
                field: 'sellsProducts',
                label: 'Sells Products',
                hint: 'Physical goods listed in your Catalogue.',
                checked: !!store.sellsProducts,
                onChange: onSellsProductsChange,
                updating: isUpdatingSellsProducts
              },
              {
                field: 'restaurantMode',
                label: 'Restaurant Mode',
                hint: 'Turns on a menu-first item form and a menu-style layout for shoppers.',
                checked: !!store.restaurantMode,
                onChange: onRestaurantModeChange,
                updating: isUpdatingRestaurantMode
              },
              {
                field: 'offersServices',
                label: 'Offers Services',
                hint: 'Adds a Services section to your dashboard and storefront for bookable/contactable services.',
                checked: !!store.offersServices,
                onChange: onOffersServicesChange,
                updating: isUpdatingOffersServices
              }
            ].map(({ field, label, hint, checked, onChange, updating }) => {
              const isLast = isLastBusinessType(store, field);
              return (
                <div key={field} className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      {label}
                      {updating && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
                    </h4>
                    <p className="text-sm text-gray-500">{hint}</p>
                    {isLast && (
                      <p className="text-xs text-amber-600 mt-1">
                        Turn on another business type before turning this off.
                      </p>
                    )}
                    {errors[field] && (
                      <p className="text-red-500 text-xs mt-1">{errors[field]}</p>
                    )}
                  </div>
                  <label className={`relative inline-flex items-center shrink-0 ml-4 ${isLast || updating ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={updating || isLast}
                      onChange={(e) => onChange(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800 peer-disabled:opacity-50"></div>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
