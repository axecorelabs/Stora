"use client";
import { useState } from "react";
import { Store, MapPin, Phone, Mail, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CustomDropdown from "../ui/CustomDropdown";

export default function CreateStoreModal({ isOpen, onStoreCreated }) {
  const { secureApiCall } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    storeName: '',
    storeDescription: '',
    storeType: 'physical', // NEW
    storePhone: '',
    storeEmail: '',
    address: {
      street: '',
      city: '',
      state: '',
      country: 'Nigeria',
      postalCode: ''
    },
    onlineStoreInfo: { // NEW
      website: '',
      socialMedia: {
        instagram: '',
        facebook: '',
        whatsapp: ''
      },
      deliveryAreas: []
    },
    settings: {
      currency: 'NGN',
      timezone: 'Africa/Lagos',
      taxRate: 0,
      receiptFooter: 'Thank you for your business!'
    }
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nigerian states for dropdown - NEW
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

  // Store type options - NEW
  const storeTypeOptions = [
    { value: 'physical', label: 'Physical Store' },
    { value: 'online', label: 'Online Store Only' }
  ];

  // Currency options
  const currencyOptions = [
    { value: 'NGN', label: 'Nigerian Naira (₦)' },
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'GBP', label: 'British Pound (£)' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const nameParts = name.split('.');
      
      if (nameParts.length === 2) {
        // Handle two-level nesting like "address.city"
        const [parent, child] = nameParts;
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        }));
      } else if (nameParts.length === 3) {
        // Handle three-level nesting like "onlineStoreInfo.socialMedia.instagram"
        const [parent, middle, child] = nameParts;
        setFormData(prev => ({
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
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!formData.storeName.trim()) {
        newErrors.storeName = 'Store name is required';
      }
      if (!formData.storeType) {
        newErrors.storeType = 'Please select store type';
      }
    }
    
    if (step === 2) {
      // Only validate address for physical stores
      if (formData.storeType === 'physical') {
        if (!formData.address.city.trim()) {
          newErrors['address.city'] = 'City is required for physical stores';
        }
        if (!formData.address.state.trim()) {
          newErrors['address.state'] = 'State is required for physical stores';
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await secureApiCall('/api/stores', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (response.success) {
        onStoreCreated(response.data);
      } else {
        setErrors({ submit: response.message || 'Failed to create store' });
      }
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to create store' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <Store className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create Your Store</h2>
              <p className="text-sm text-gray-500">Set up your store to start using the POS system</p>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="mt-6">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep 
                      ? 'bg-teal-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-12 h-1 ml-2 ${
                      step < currentStep ? 'bg-teal-600' : 'bg-gray-200'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
            {/* <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Basic Info</span>
              <span>Location</span>
              <span>Settings</span>
            </div> */}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Store className="w-5 h-5 mr-2 text-gray-600" />
                  Tell us about your store
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Store Name *
                    </label>
                    <input
                      type="text"
                      name="storeName"
                      value={formData.storeName}
                      onChange={handleChange}
                      placeholder="e.g., John's Electronics Store"
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                        errors.storeName ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.storeName && (
                      <p className="text-red-500 text-xs mt-1">{errors.storeName}</p>
                    )}
                  </div>

                  {/* Store Type Selection - NEW */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Store Type *
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Do you have a physical store location or is it online only?
                    </p>
                    <CustomDropdown
                      options={storeTypeOptions}
                      value={formData.storeType}
                      onChange={(value) => handleChange({ target: { name: 'storeType', value } })}
                      placeholder="Select store type"
                      error={!!errors.storeType}
                    />
                    {errors.storeType && (
                      <p className="text-red-500 text-xs mt-1">{errors.storeType}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Store Description
                    </label>
                    <textarea
                      name="storeDescription"
                      value={formData.storeDescription}
                      onChange={handleChange}
                      rows={3}
                      placeholder="What does your store sell? (optional)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Store Phone
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="tel"
                          name="storePhone"
                          value={formData.storePhone}
                          onChange={handleChange}
                          placeholder="08012345678"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Store Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="email"
                          name="storeEmail"
                          value={formData.storeEmail}
                          onChange={handleChange}
                          placeholder="store@example.com"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-gray-600" />
                  {formData.storeType === 'physical' ? 'Where is your store located?' : 'Store Information'}
                </h3>
                
                {formData.storeType === 'physical' ? (
                  // Physical store address form
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        name="address.street"
                        value={formData.address.street}
                        onChange={handleChange}
                        placeholder="e.g., 123 Main Street, Ikeja"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          name="address.city"
                          value={formData.address.city}
                          onChange={handleChange}
                          placeholder="e.g., Lagos"
                          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                            errors['address.city'] ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {errors['address.city'] && (
                          <p className="text-red-500 text-xs mt-1">{errors['address.city']}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State *
                        </label>
                        <CustomDropdown
                          options={nigerianStates}
                          value={formData.address.state}
                          onChange={(value) => handleChange({ target: { name: 'address.state', value } })}
                          placeholder="Select state"
                          error={!!errors['address.state']}
                        />
                        {errors['address.state'] && (
                          <p className="text-red-500 text-xs mt-1">{errors['address.state']}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country
                        </label>
                        <input
                          type="text"
                          value="Nigeria"
                          disabled
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Postal Code
                        </label>
                        <input
                          type="text"
                          name="address.postalCode"
                          value={formData.address.postalCode}
                          onChange={handleChange}
                          placeholder="100001"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Online store information form
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-blue-800 text-sm">
                        <strong>Online Store Setup:</strong> Since you selected "Online Store Only", 
                        you can skip physical address details. You can optionally provide your website 
                        and social media information below.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Website URL (Optional)
                      </label>
                      <input
                        type="url"
                        name="onlineStoreInfo.website"
                        value={formData.onlineStoreInfo.website}
                        onChange={handleChange}
                        placeholder="https://yourstore.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                      />
                      <div className="mt-2 p-3 bg-teal-50 rounded-lg border border-teal-200">
                        <p className="text-teal-800 text-xs">
                          <strong>💡 Pro Tip:</strong> Don't have a website yet? We'll also provide you with a custom store on the IVMA e-commerce platform where you can showcase and sell your products online!
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Instagram Handle
                        </label>
                        <input
                          type="text"
                          name="onlineStoreInfo.socialMedia.instagram"
                          value={formData.onlineStoreInfo.socialMedia.instagram}
                          onChange={handleChange}
                          placeholder="@yourstore"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          WhatsApp Number
                        </label>
                        <input
                          type="tel"
                          name="onlineStoreInfo.socialMedia.whatsapp"
                          value={formData.onlineStoreInfo.socialMedia.whatsapp}
                          onChange={handleChange}
                          placeholder="08012345678"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Settings */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-gray-600" />
                  Configure your store settings
                </h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Currency
                      </label>
                      <CustomDropdown
                        options={currencyOptions}
                        value={formData.settings.currency}
                        onChange={(value) => handleChange({ target: { name: 'settings.currency', value } })}
                        placeholder="Select currency"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        name="settings.taxRate"
                        value={formData.settings.taxRate}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Receipt Footer Message
                    </label>
                    <input
                      type="text"
                      name="settings.receiptFooter"
                      value={formData.settings.receiptFooter}
                      onChange={handleChange}
                      placeholder="Thank you for your business!"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Step {currentStep} of 3
          </div>
          
          <div className="flex items-center space-x-3">
            {currentStep > 1 && (
              <button
                onClick={handlePrevious}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
            )}
            
            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Store...
                  </>
                ) : (
                  'Create Store'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
