"use client";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  Store,
  MapPin,
  Edit3,
  DollarSign,
  CheckCircle2,
  Sparkles,
  Package,
  Receipt,
  Calendar,
  Palette,
  Save,
  X,
  AlertCircle,
  Landmark,
  Truck,
  Settings as SettingsIcon
} from "lucide-react";
import Button from "@/components/ui/Button";
import CreateStoreModal from "@/components/dashboard/CreateStoreModal";
import AddPhysicalStoreModal from "@/components/dashboard/AddPhysicalStoreModal";
import StoreBrandingModal from "@/components/dashboard/StoreBrandingModal";
import PayoutSettingsModal from "@/components/dashboard/PayoutSettingsModal";
import StoreGeneralTab from "@/components/dashboard/store/StoreGeneralTab";
import StoreLocationTab from "@/components/dashboard/store/StoreLocationTab";
import StoreDeliveryTab from "@/components/dashboard/store/StoreDeliveryTab";
import StorePreferencesTab from "@/components/dashboard/store/StorePreferencesTab";
import { useRouter } from "next/navigation";
import { NIGERIAN_STATES } from "@stora/shared-constants";

const STORE_TABS = [
  { id: 'general', label: 'General', icon: Store },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'preferences', label: 'Preferences', icon: SettingsIcon }
];

export default function StorePage() {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  const [store, setStore] = useState(null);
  const [salesStats, setSalesStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingFulfillmentMethod, setIsUpdatingFulfillmentMethod] = useState(false);
  const [isCreateStoreModalOpen, setIsCreateStoreModalOpen] = useState(false);
  const [isAddPhysicalStoreModalOpen, setIsAddPhysicalStoreModalOpen] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Nigerian states for dropdown
  const nigerianStates = [{ value: '', label: 'Select State' }, ...NIGERIAN_STATES];

  // Currency options
  const currencyOptions = [
    { value: 'NGN', label: 'Nigerian Naira (₦)' },
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'GBP', label: 'British Pound (£)' }
  ];

  // Fetch store information
  const fetchStore = async () => {
    try {
      setLoading(true);
      const response = await secureApiCall('/api/stores');
      if (response.success && response.hasStore) {
        setStore(response.data);
      } else {
        // No store found, open create modal
        setIsCreateStoreModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching store:', error);
      // On error, also show create modal
      setIsCreateStoreModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Fetch real sales stats -- the stores table's own total_sales/total_orders
  // columns are never updated by the app, so they don't reflect actual sales
  const fetchSalesStats = async () => {
    try {
      const response = await secureApiCall('/api/pos/sales/stats');
      if (response.success) {
        setSalesStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching sales stats:', error);
    }
  };

  useEffect(() => {
    fetchStore();
    fetchSalesStats();
  }, []);

  // Handle store creation
  const handleStoreCreated = (newStore) => {
    setStore(newStore);
    setIsCreateStoreModalOpen(false);
  };

  // Handle physical store addition
  const handlePhysicalStoreAdded = (updatedStore) => {
    setStore(updatedStore);
    setIsAddPhysicalStoreModalOpen(false);
  };

  // Handle branding update
  const handleBrandingUpdated = (updatedStore) => {
    setStore(updatedStore);
    setIsBrandingModalOpen(false);
  };

  // Handle payout settings update
  const handlePayoutUpdated = (updatedStore) => {
    setStore(updatedStore);
    setIsPayoutModalOpen(false);
  };

  const startEditing = () => {
    setEditData({
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
    });
    setIsEditing(true);
    setErrors({});
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({});
    setErrors({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const nameParts = name.split('.');
      
      if (nameParts.length === 2) {
        const [parent, child] = nameParts;
        setEditData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        }));
      } else if (nameParts.length === 3) {
        const [parent, middle, child] = nameParts;
        setEditData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [middle]: {
              ...prev[parent][middle],
              [child]: value
            }
          }
        }));
      }
    } else {
      setEditData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
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
    return Object.keys(newErrors).length === 0;
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

  // Bulk-sets every state in a zone that doesn't already have an explicit
  // fee -- never overwrites a state the vendor already customized, so this
  // is purely a data-entry shortcut, not a way to reset a whole zone.
  const setDeliveryFeeForZone = (statesInZone, amount) => {
    setEditData(prev => {
      const nextFees = { ...prev.deliveryFees };
      for (const state of statesInZone) {
        if (nextFees[state] === undefined) nextFees[state] = amount;
      }
      return { ...prev, deliveryFees: nextFees };
    });
  };

  const handleFulfillmentMethodChange = async (fulfillmentMethod) => {
    if (fulfillmentMethod === store.fulfillmentMethod || isUpdatingFulfillmentMethod) return;
    setIsUpdatingFulfillmentMethod(true);
    try {
      const response = await secureApiCall('/api/stores/fulfillment-method', {
        method: 'PATCH',
        body: JSON.stringify({ fulfillmentMethod })
      });
      if (response.success) {
        setStore(prev => ({ ...prev, fulfillmentMethod: response.data.fulfillmentMethod }));
      } else {
        setErrors(prev => ({ ...prev, fulfillmentMethod: response.message || 'Failed to update' }));
      }
    } finally {
      setIsUpdatingFulfillmentMethod(false);
    }
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
          // field is the active source for this store type -- physical
          // stores edit address.state, online-only stores edit the
          // standalone field below, but only one value should ever reach
          // the DB as "the" operating state.
          // Falsy (never-set) state is omitted entirely, not sent as ''--
          // JSON.stringify drops an `undefined` value's key, so the PUT
          // handler's `updateData.state !== undefined` check correctly
          // treats an unset state as "leave alone," not "reject as
          // invalid." Physical stores already require address.state via
          // validateForm() above, so this only ever matters for
          // online-only stores that haven't set one yet.
          state: (store.storeType === 'physical' ? editData.address.state : editData.state) || undefined,
          deliveryStates: editData.deliveryNationwide ? null : editData.deliveryStates,
          deliveryFees: editData.deliveryFees || {}
        })
      });

      if (response.success) {
        setStore(response.data);
        setIsEditing(false);
        setEditData({});
        setErrors({});
      } else {
        setErrors({ submit: response.message || 'Failed to update store' });
      }
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to update store' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <DashboardLayout title="Store Management" subtitle="Manage your store information and settings">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading store information...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!store) {
    return (
      <DashboardLayout title="Store Management" subtitle="Manage your store information and settings">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium mb-2">No store found</p>
            <p className="text-gray-400 text-sm mb-4">Create your store to get started</p>
            <button
              onClick={() => setIsCreateStoreModalOpen(true)}
              className="px-6 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors"
            >
              Create Store
            </button>
          </div>
        </div>

        {/* Create Store Modal */}
        <CreateStoreModal
          isOpen={isCreateStoreModalOpen}
          onStoreCreated={handleStoreCreated}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Store Management" subtitle="Manage your store information and settings">
      {/* Store Header */}
      <div className="mb-8 bg-white rounded-2xl p-5 sm:p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-brand-100 rounded-2xl shrink-0">
              <Store className="w-8 h-8 text-brand-800" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{store.storeName}</h1>
              <div className="flex items-center flex-wrap gap-2 mt-0.5">
                <p className="text-gray-500 text-sm sm:text-base">{store.storeType === 'physical' ? 'Physical Store' : 'Online Store'}</p>
                {store.storeType === 'online' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Online Only
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {/* Add Physical Store Button - only show for online stores */}
            {store.storeType === 'online' && (
              <Button variant="gold" onClick={() => setIsAddPhysicalStoreModalOpen(true)} className="w-full sm:w-auto">
                <MapPin className="w-4 h-4" />
                <span>Add Physical Store</span>
              </Button>
            )}

            {!isEditing ? (
              <Button variant="primary" onClick={startEditing} className="w-full sm:w-auto">
                <Edit3 className="w-4 h-4" />
                <span>Edit Store</span>
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button variant="secondary" onClick={cancelEditing} className="w-full sm:w-auto">
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={isSubmitting} className="w-full sm:w-auto">
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {errors.submit && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{errors.submit}</p>
        </div>
      )}

      {/* Store Stats Strip */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-100 text-brand-800">
                <Receipt className="w-4 h-4" />
              </span>
              <span className="text-sm text-gray-500">Total Sales</span>
            </div>
            <p className="text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
              {salesStats ? salesStats.totalSales : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Completed transactions</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gold-500/15 text-gold-600">
                <DollarSign className="w-4 h-4" />
              </span>
              <span className="text-sm text-gray-500">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
              {salesStats ? formatCurrency(salesStats.totalRevenue) : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Lifetime earnings</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-100 text-brand-800">
                <Calendar className="w-4 h-4" />
              </span>
              <span className="text-sm text-gray-500">Last Sale</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {salesStats?.lastSaleDate ? formatDate(salesStats.lastSaleDate) : 'No sales yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Most recent activity</p>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="mb-8 bg-white rounded-2xl border border-gray-100">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {STORE_TABS.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-brand-800 border-b-2 border-brand-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <TabIcon className="w-4 h-4 inline mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Information -- one section per tab, each its own component
            (apps/dashboard/src/components/dashboard/store/) rather than
            four sections inlined in one file. */}
        <div className="lg:col-span-2">
          {activeTab === 'general' && (
            <StoreGeneralTab store={store} isEditing={isEditing} editData={editData} errors={errors} handleChange={handleChange} />
          )}
          {activeTab === 'location' && (
            <StoreLocationTab store={store} isEditing={isEditing} editData={editData} errors={errors} handleChange={handleChange} nigerianStates={nigerianStates} />
          )}
          {activeTab === 'delivery' && (
            <StoreDeliveryTab
              store={store}
              isEditing={isEditing}
              editData={editData}
              errors={errors}
              setDeliveryNationwide={setDeliveryNationwide}
              toggleDeliveryState={toggleDeliveryState}
              setDeliveryFee={setDeliveryFee}
              setDeliveryFeeForZone={setDeliveryFeeForZone}
              onFulfillmentMethodChange={handleFulfillmentMethodChange}
              isUpdatingFulfillmentMethod={isUpdatingFulfillmentMethod}
            />
          )}
          {activeTab === 'preferences' && (
            <StorePreferencesTab store={store} isEditing={isEditing} editData={editData} handleChange={handleChange} currencyOptions={currencyOptions} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Store Status */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-brand-100 text-brand-800">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </span>
              Store Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  store.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {store.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Setup Complete</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  store.setupCompleted ? 'bg-green-100 text-green-800' : 'bg-gold-500/15 text-gold-600'
                }`}>
                  {store.setupCompleted ? 'Complete' : 'Incomplete'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Created</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(store.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Updated</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(store.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-gold-500/15 text-gold-600">
                <Sparkles className="w-4.5 h-4.5" />
              </span>
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/dashboard/sales')}
                className="w-full flex items-center justify-center px-4 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors"
              >
                <Receipt className="w-4 h-4 mr-2" />
                View Sales
              </button>
              <button 
                onClick={() => router.push('/dashboard/inventory')}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Package className="w-4 h-4 mr-2" />
                Manage Inventory
              </button>
              {store.storeType === 'online' && (
                <button
                  onClick={() => setIsAddPhysicalStoreModalOpen(true)}
                  className="w-full flex items-center justify-center px-4 py-3 bg-gold-500 text-brand-900 rounded-xl hover:bg-gold-400 transition-colors shadow-sm hover:shadow-md"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Add Physical Location
                </button>
              )}
              <button
                onClick={() => setIsBrandingModalOpen(true)}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Palette className="w-4 h-4 mr-2" />
                Customize Branding
              </button>
              <button
                onClick={() => setIsPayoutModalOpen(true)}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Landmark className="w-4 h-4 mr-2" />
                {store.bankDetails?.paystack_subaccount_code ? 'Payout Settings' : 'Set Up Payouts'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Store Modal */}
      <CreateStoreModal
        isOpen={isCreateStoreModalOpen}
        onStoreCreated={handleStoreCreated}
      />

      {/* Add Physical Store Modal */}
      <AddPhysicalStoreModal
        isOpen={isAddPhysicalStoreModalOpen}
        onClose={() => setIsAddPhysicalStoreModalOpen(false)}
        onStoreUpdated={handlePhysicalStoreAdded}
        store={store}
      />

      {/* Store Branding Modal */}
      <StoreBrandingModal
        isOpen={isBrandingModalOpen}
        onClose={() => setIsBrandingModalOpen(false)}
        onBrandingUpdated={handleBrandingUpdated}
        store={store}
      />

      {/* Payout Settings Modal */}
      <PayoutSettingsModal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        onPayoutUpdated={handlePayoutUpdated}
        store={store}
      />
    </DashboardLayout>
  );
}
