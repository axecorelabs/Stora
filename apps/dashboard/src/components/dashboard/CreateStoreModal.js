"use client";
import { useState, useEffect } from "react";
import { Store, MapPin, Phone, Mail, Settings, Check, Sparkles, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CustomDropdown from "../ui/CustomDropdown";
import Button from "../ui/Button";
import { NIGERIAN_STATES } from "@stora/shared-constants";

const STEPS = [
  { number: 1, label: "Basics" },
  { number: 2, label: "Location" },
  { number: 3, label: "Settings" }
];

function StepIndicator({ currentStep }) {
  return (
    <div className="mt-6 flex items-center">
      {STEPS.map((step, idx) => {
        const isComplete = step.number < currentStep;
        const isCurrent = step.number === currentStep;
        return (
          <div key={step.number} className={`flex items-center ${idx < STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isComplete
                    ? "bg-brand-800 text-white"
                    : isCurrent
                    ? "bg-brand-800 text-white ring-4 ring-brand-100"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {isComplete ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  isCurrent ? "text-brand-800" : isComplete ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 -mt-5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-brand-800 transition-all duration-500 ease-out"
                  style={{ width: step.number < currentStep ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CreateStoreModal({ isOpen, onStoreCreated, embedded = false }) {
  const { secureApiCall } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    storeName: '',
    storeDescription: '',
    storeType: 'physical', // NEW
    storePhone: '',
    storeEmail: '',
    // Main operating state -- required for every store regardless of
    // storeType. Physical stores keep using address.state (unchanged);
    // this is only the online-only stores' home for it, since they never
    // fill in `address` at all.
    state: '',
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
  // Soft, informational only -- store_name isn't unique (store_slug is;
  // see /api/stores/check-name's comment), so this never blocks submission,
  // it just lets a vendor know someone else already has that name before
  // they commit to it.
  const [nameTaken, setNameTaken] = useState(false);

  // Debounced so this isn't firing a request per keystroke -- 400ms is
  // long enough to skip past normal typing cadence, short enough that the
  // warning still feels responsive once someone pauses.
  useEffect(() => {
    const trimmed = formData.storeName.trim();
    // Guards against an older, slower request resolving after a newer one
    // already has -- without this, typing "Comfortingscents" then quickly
    // continuing to type past it could have the stale first response land
    // last and overwrite the correct, more recent result.
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!trimmed) {
        if (!cancelled) setNameTaken(false);
        return;
      }
      try {
        const response = await secureApiCall(`/api/stores/check-name?name=${encodeURIComponent(trimmed)}`);
        if (!cancelled) setNameTaken(!!response?.exists);
      } catch (error) {
        // Fail quiet -- this is a nicety, not a blocker; no reason to
        // surface a network hiccup here.
        if (!cancelled) setNameTaken(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.storeName]);

  // Nigerian states for dropdown
  const nigerianStates = [{ value: '', label: 'Select State' }, ...NIGERIAN_STATES];

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
      if (formData.storeType === 'physical') {
        if (!formData.address.city.trim()) {
          newErrors['address.city'] = 'City is required for physical stores';
        }
        if (!formData.address.state.trim()) {
          newErrors['address.state'] = 'State is required for physical stores';
        }
      } else if (!formData.state) {
        // Online-only stores skip the address block entirely, but every
        // store still needs an operating state -- see CreateStoreModal's
        // top-level `state` field.
        newErrors.state = 'Operating state is required';
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
        body: JSON.stringify({
          ...formData,
          state: formData.storeType === 'physical' ? formData.address.state : formData.state
        })
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

  const card = (
    <div className={`bg-white rounded-2xl w-full overflow-hidden ${embedded ? "" : "max-w-2xl max-h-[90vh]"}`}>
      <div className="h-1 bg-gradient-to-r from-brand-700 via-brand-600 to-gold-500" />

      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-brand-100 rounded-xl">
            <Store className="w-6 h-6 text-brand-800" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-900">Create Your Store</h2>
            <p className="text-sm text-gray-500">Set up your store to start using the POS system</p>
          </div>
        </div>

        <StepIndicator currentStep={currentStep} />
      </div>

      {/* Form Content */}
      <div className={`p-6 overflow-y-auto ${embedded ? "" : "max-h-[calc(90vh-200px)]"}`}>
        {errors.submit && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{errors.submit}</p>
          </div>
        )}

        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                <Store className="w-4.5 h-4.5 mr-2 text-brand-700" />
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
                    className={`w-full px-4 py-3 border rounded-xl transition-colors focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                      errors.storeName ? 'border-red-300' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                  {errors.storeName && (
                    <p className="text-red-500 text-xs mt-1">{errors.storeName}</p>
                  )}
                  {!errors.storeName && nameTaken && (
                    <p className="text-amber-600 text-xs mt-1.5 flex items-start gap-1">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      A store named &quot;{formData.storeName.trim()}&quot; already exists. You can
                      still use this name, but shoppers may confuse the two -- consider something
                      more distinct.
                    </p>
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
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
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
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
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
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
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-4.5 h-4.5 mr-2 text-brand-700" />
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
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
                        className={`w-full px-4 py-3 border rounded-xl transition-colors focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                          errors['address.city'] ? 'border-red-300' : 'border-gray-300 hover:border-gray-400'
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
                      <p className="text-xs text-gray-500 mb-2">
                        Shown to buyers so they can find vendors closer to them.
                      </p>
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // Online store information form
                <div className="space-y-4">
                  <div className="p-4 bg-brand-50 rounded-xl border border-brand-100 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-brand-700 flex-shrink-0 mt-0.5" />
                    <p className="text-brand-800 text-sm">
                      Since you selected &ldquo;Online Store Only,&rdquo; you can skip physical address details.
                      Website and social media info below are optional.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Main Operating State *
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Where you&apos;re based -- shown to buyers so they can find vendors closer to them.
                    </p>
                    <CustomDropdown
                      options={nigerianStates}
                      value={formData.state}
                      onChange={(value) => handleChange({ target: { name: 'state', value } })}
                      placeholder="Select state"
                      error={!!errors.state}
                    />
                    {errors.state && (
                      <p className="text-red-500 text-xs mt-1">{errors.state}</p>
                    )}
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                    />
                    <div className="mt-2 p-3 bg-gold-400/10 rounded-lg border border-gold-500/25 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-gold-700 flex-shrink-0 mt-0.5" />
                      <p className="text-brand-900/80 text-xs">
                        Don&apos;t have a website yet? We&apos;ll also give you a custom store on the Stora
                        e-commerce platform to showcase and sell your products online.
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
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
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                <Settings className="w-4.5 h-4.5 mr-2 text-brand-700" />
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
        {currentStep > 1 && (
          <Button variant="secondary" onClick={handlePrevious}>
            Previous
          </Button>
        )}

        {currentStep < 3 ? (
          <Button variant="primary" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
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
          </Button>
        )}
      </div>
    </div>
  );

  if (embedded) return card;

  return (
    <div className="fixed inset-0 bg-brand-900/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      {card}
    </div>
  );
}
