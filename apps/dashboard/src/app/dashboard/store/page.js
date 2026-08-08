"use client";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Store, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Instagram, 
  MessageCircle,
  Edit3,
  Settings,
  DollarSign,
  Clock,
  Users,
  Package,
  Receipt,
  Calendar,
  Palette,
  Save,
  X,
  AlertCircle
} from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import CreateStoreModal from "@/components/dashboard/CreateStoreModal";
import AddPhysicalStoreModal from "@/components/dashboard/AddPhysicalStoreModal";
import StoreBrandingModal from "@/components/dashboard/StoreBrandingModal";
import { useRouter } from "next/navigation";

export default function StorePage() {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateStoreModalOpen, setIsCreateStoreModalOpen] = useState(false);
  const [isAddPhysicalStoreModalOpen, setIsAddPhysicalStoreModalOpen] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);

  // Nigerian states for dropdown
  const nigerianStates = [
    { value: '', label: 'Select State' },
    { value: 'Abia', label: 'Abia' },
    { value: 'Adamawa', label: 'Adamawa' },
    { value: 'Akwa Ibom', label: 'Akwa Ibom' },
    { value: 'Anambra', label: 'Anambra' },
    { value: 'Bauchi', label: 'Bauchi' },
    { value: 'Bayelsa', label: 'Bayelsa' },
    { value: 'Benue', label: 'Benue' },
    { value: 'Borno', label: 'Borno' },
    { value: 'Cross River', label: 'Cross River' },
    { value: 'Delta', label: 'Delta' },
    { value: 'Ebonyi', label: 'Ebonyi' },
    { value: 'Edo', label: 'Edo' },
    { value: 'Ekiti', label: 'Ekiti' },
    { value: 'Enugu', label: 'Enugu' },
    { value: 'FCT', label: 'Federal Capital Territory' },
    { value: 'Gombe', label: 'Gombe' },
    { value: 'Imo', label: 'Imo' },
    { value: 'Jigawa', label: 'Jigawa' },
    { value: 'Kaduna', label: 'Kaduna' },
    { value: 'Kano', label: 'Kano' },
    { value: 'Katsina', label: 'Katsina' },
    { value: 'Kebbi', label: 'Kebbi' },
    { value: 'Kogi', label: 'Kogi' },
    { value: 'Kwara', label: 'Kwara' },
    { value: 'Lagos', label: 'Lagos' },
    { value: 'Nasarawa', label: 'Nasarawa' },
    { value: 'Niger', label: 'Niger' },
    { value: 'Ogun', label: 'Ogun' },
    { value: 'Ondo', label: 'Ondo' },
    { value: 'Osun', label: 'Osun' },
    { value: 'Oyo', label: 'Oyo' },
    { value: 'Plateau', label: 'Plateau' },
    { value: 'Rivers', label: 'Rivers' },
    { value: 'Sokoto', label: 'Sokoto' },
    { value: 'Taraba', label: 'Taraba' },
    { value: 'Yobe', label: 'Yobe' },
    { value: 'Zamfara', label: 'Zamfara' }
  ];

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

  useEffect(() => {
    fetchStore();
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

  const startEditing = () => {
    setEditData({
      storeName: store.storeName,
      storeDescription: store.storeDescription,
      storePhone: store.storePhone,
      storeEmail: store.storeEmail,
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await secureApiCall('/api/stores', {
        method: 'PUT',
        body: JSON.stringify(editData)
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
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
              className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
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
      <div className="mb-8 bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-teal-100 rounded-2xl">
              <Store className="w-8 h-8 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{store.storeName}</h1>
              <div className="flex items-center space-x-2">
                <p className="text-gray-500">{store.storeType === 'physical' ? 'Physical Store' : 'Online Store'}</p>
                {store.storeType === 'online' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Online Only
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Add Physical Store Button - only show for online stores */}
            {store.storeType === 'online' && (
              <button
                onClick={() => setIsAddPhysicalStoreModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span>Add Physical Store</span>
              </button>
            )}
            
            {!isEditing ? (
              <button
                onClick={startEditing}
                className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Store</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={cancelEditing}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Information */}
        <div className="lg:col-span-2 space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <Store className="w-5 h-5 mr-2 text-gray-600" />
              Basic Information
            </h2>
            
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
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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

          {/* Location Information */}
          {store.storeType === 'physical' ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-gray-600" />
                Location Information
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="address.street"
                      value={editData.address.street}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                      />
                    ) : (
                      <p className="text-gray-900 py-3">{store.address.postalCode || 'Not provided'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Online Store Information */
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <Globe className="w-5 h-5 mr-2 text-gray-600" />
                Online Presence
              </h2>
              
              <div className="space-y-6">
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Website URL</label>
                  {isEditing ? (
                    <input
                      type="url"
                      name="onlineStoreInfo.website"
                      value={editData.onlineStoreInfo.website}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                    />
                  ) : (
                    <div className="flex items-center py-3">
                      <Globe className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-gray-900">{store.onlineStoreInfo?.website || 'Not provided'}</span>
                    </div>
                  )}
                </div> */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Instagram Handle</label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="onlineStoreInfo.socialMedia.instagram"
                        value={editData.onlineStoreInfo.socialMedia.instagram}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
          )}

          {/* Store Settings */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-gray-600" />
              Store Settings
            </h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                  {isEditing ? (
                    <CustomDropdown
                      options={currencyOptions}
                      value={editData.settings.currency}
                      onChange={(value) => handleChange({ target: { name: 'settings.currency', value } })}
                      placeholder="Select currency"
                    />
                  ) : (
                    <div className="flex items-center py-3">
                      <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-gray-900">{currencyOptions.find(opt => opt.value === store.settings.currency)?.label || store.settings.currency}</span>
                    </div>
                  )}
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                  />
                ) : (
                  <p className="text-gray-900 py-3">{store.settings.receiptFooter}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Store Stats */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Store Statistics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Receipt className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-600">Total Sales</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{store.totalSales}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-600">Total Revenue</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(store.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-600">Last Sale</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {store.lastSaleDate ? formatDate(store.lastSaleDate) : 'No sales yet'}
                </span>
              </div>
            </div>
          </div>

          {/* Store Status */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Store Status</h3>
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
                  store.setupCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button 
                onClick={() => router.push('/dashboard/sales')}
                className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
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
                  className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
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
    </DashboardLayout>
  );
}
