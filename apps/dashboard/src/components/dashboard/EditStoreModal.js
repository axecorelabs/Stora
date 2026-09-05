"use client";
import { useState } from "react";
import { Store, MapPin, Truck, Settings as SettingsIcon, X, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "../ui/Button";
import StoreGeneralTab from "./store/StoreGeneralTab";
import StoreLocationTab from "./store/StoreLocationTab";
import StoreDeliveryTab from "./store/StoreDeliveryTab";
import StorePreferencesTab from "./store/StorePreferencesTab";
import { NIGERIAN_STATES } from "@stora/shared-constants";

// errorKeys ties each validation error to the tab it actually lives on --
// the previous inline-editing page validated fine, but a failing field on
// a tab you weren't looking at meant clicking Save just silently did
// nothing (the only globally-visible error was `submit`, which
// validateForm() never set). A modal with its own tab strip fixes this at
// the source: on a failed validation, jump straight to the first tab that
// has one, and mark every tab with an error with a dot, so it's never
// possible to be looking at a passing tab while Save is actually blocked.
const TABS = [
  { id: 'general', label: 'General', icon: Store, errorKeys: ['storeName'] },
  { id: 'location', label: 'Location', icon: MapPin, errorKeys: ['address.city', 'address.state'] },
  { id: 'delivery', label: 'Delivery', icon: Truck, errorKeys: ['deliveryStates'] },
  { id: 'preferences', label: 'Preferences', icon: SettingsIcon, errorKeys: [] }
];

function buildEditData(store) {
  return {
    storeName: store.storeName,
    storeDescription: store.storeDescription,
    storePhone: store.storePhone,
    storeEmail: store.storeEmail,
    state: store.state || '',
    deliveryNationwide: store.deliveryNationwide,
    deliveryStates: store.deliveryStates || [],
    deliveryFees: store.deliveryFees || {},
    address: { ...store.address },
    onlineStoreInfo: {
      website: store.onlineStoreInfo?.website || '',
      socialMedia: {
        instagram: store.onlineStoreInfo?.socialMedia?.instagram || '',
        whatsapp: store.onlineStoreInfo?.socialMedia?.whatsapp || ''
      }
    },
    settings: { ...store.settings }
  };
}

// Business-type toggles (Sells Products/Restaurant Mode/Offers Services)
// and fulfillment method all save instantly and live on the main Store
// page instead (see hideInstantToggles on StorePreferencesTab.js/
// StoreDeliveryTab.js) -- this modal only ever handles the batched fields
// that need an explicit Save.
//
// Thin wrapper around EditStoreForm: only mounts the form while open, so
// it always starts from a fresh, lazily-initialized state seeded from the
// current `store` -- no reset-on-reopen effect needed, and no stale edit
// from a previous open (then cancelled) can ever bleed into the next one.
export default function EditStoreModal({ isOpen, onClose, store, onStoreUpdated }) {
  if (!isOpen || !store) return null;
  return <EditStoreForm store={store} onClose={onClose} onStoreUpdated={onStoreUpdated} />;
}

function EditStoreForm({ store, onClose, onStoreUpdated }) {
  const { secureApiCall } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [editData, setEditData] = useState(() => buildEditData(store));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nigerianStates = [{ value: '', label: 'Select State' }, ...NIGERIAN_STATES];

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const nameParts = name.split('.');

      if (nameParts.length === 2) {
        const [parent, child] = nameParts;
        setEditData(prev => ({
          ...prev,
          [parent]: { ...prev[parent], [child]: value }
        }));
      } else if (nameParts.length === 3) {
        const [parent, middle, child] = nameParts;
        setEditData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [middle]: { ...prev[parent][middle], [child]: value }
          }
        }));
      }
    } else {
      setEditData(prev => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const setDeliveryNationwide = (nationwide) => {
    setEditData(prev => ({ ...prev, deliveryNationwide: nationwide }));
    if (errors.deliveryStates) setErrors(prev => ({ ...prev, deliveryStates: '' }));
  };

  const toggleDeliveryState = (states) => {
    setEditData(prev => ({ ...prev, deliveryStates: states }));
    if (errors.deliveryStates) setErrors(prev => ({ ...prev, deliveryStates: '' }));
  };

  const setDeliveryFee = (state, amount) => {
    setEditData(prev => ({ ...prev, deliveryFees: { ...prev.deliveryFees, [state]: amount } }));
  };

  const setDeliveryFeeForZone = (statesInZone, amount) => {
    setEditData(prev => {
      const nextFees = { ...prev.deliveryFees };
      for (const state of statesInZone) {
        if (nextFees[state] === undefined) nextFees[state] = amount;
      }
      return { ...prev, deliveryFees: nextFees };
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!editData.storeName?.trim()) {
      newErrors.storeName = 'Store name is required';
    }

    if (store.storeType === 'physical') {
      if (!editData.address?.city?.trim()) {
        newErrors['address.city'] = 'City is required for physical stores';
      }
      if (!editData.address?.state?.trim()) {
        newErrors['address.state'] = 'State is required for physical stores';
      }
    }

    if (!editData.deliveryNationwide && (editData.deliveryStates || []).length === 0) {
      newErrors.deliveryStates = 'Select at least one state, or choose Nationwide';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorTab = TABS.find((tab) => tab.errorKeys.some((key) => newErrors[key]));
      if (firstErrorTab) setActiveTab(firstErrorTab.id);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await secureApiCall('/api/stores', {
        method: 'PUT',
        body: JSON.stringify({
          ...editData,
          // Keep the canonical stores.state column in sync with whichever
          // field is the active source for this store type -- see
          // store/page.js's original handleSave for the full reasoning.
          state: (store.storeType === 'physical' ? editData.address.state : editData.state) || undefined,
          deliveryStates: editData.deliveryNationwide ? null : editData.deliveryStates,
          deliveryFees: editData.deliveryFees || {}
        })
      });

      if (response.success) {
        onStoreUpdated(response.data);
        onClose();
      } else {
        setErrors({ submit: response.message || 'Failed to update store' });
      }
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to update store' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabHasError = (tabId) => TABS.find((t) => t.id === tabId).errorKeys.some((key) => errors[key]);

  return (
    <div className="fixed inset-0 bg-brand-900/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="h-1 bg-gradient-to-r from-brand-700 via-brand-600 to-gold-500 flex-shrink-0" />

        {/* Header */}
        <div className="p-6 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-brand-100 rounded-xl shrink-0">
                <Store className="w-6 h-6 text-brand-800" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold text-brand-900 truncate">Edit Store</h2>
                <p className="text-sm text-gray-500">Update your store&apos;s information</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0 ml-2"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="flex gap-1 mt-5 border-b border-gray-200 overflow-x-auto">
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              const hasError = tabHasError(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'text-brand-800 border-brand-800'
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                  {hasError && <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-label="Has an error" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {activeTab === 'general' && (
            <StoreGeneralTab store={store} isEditing editData={editData} errors={errors} handleChange={handleChange} />
          )}
          {activeTab === 'location' && (
            <StoreLocationTab store={store} isEditing editData={editData} errors={errors} handleChange={handleChange} nigerianStates={nigerianStates} />
          )}
          {activeTab === 'delivery' && (
            <StoreDeliveryTab
              store={store}
              isEditing
              editData={editData}
              errors={errors}
              setDeliveryNationwide={setDeliveryNationwide}
              toggleDeliveryState={toggleDeliveryState}
              setDeliveryFee={setDeliveryFee}
              setDeliveryFeeForZone={setDeliveryFeeForZone}
              hideInstantToggles
            />
          )}
          {activeTab === 'preferences' && (
            <StorePreferencesTab store={store} isEditing editData={editData} handleChange={handleChange} hideInstantToggles />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
