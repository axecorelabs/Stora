"use client";
import { useState } from "react";
import { Store, MapPin, X, Building } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CustomDropdown from "../ui/CustomDropdown";

export default function AddPhysicalStoreModal({ isOpen, onClose, onStoreUpdated, store }) {
  const { secureApiCall } = useAuth();
  const [formData, setFormData] = useState({
    address: {
      street: '',
      city: '',
      state: '',
      country: 'Nigeria',
      postalCode: ''
    }
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
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

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.address.city?.trim()) {
      newErrors['address.city'] = 'City is required';
    }
    if (!formData.address.state?.trim()) {
      newErrors['address.state'] = 'State is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setErrors({});

    try {
      const updateData = {
        storeType: 'physical',
        address: formData.address
      };

      const response = await secureApiCall('/api/stores', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response.success) {
        onStoreUpdated(response.data);
        onClose();
        // Reset form
        setFormData({
          address: {
            street: '',
            city: '',
            state: '',
            country: 'Nigeria',
            postalCode: ''
          }
        });
      } else {
        setErrors({ submit: response.message || 'Failed to add physical store' });
      }
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to add physical store' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <Building className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Add Physical Store Location</h2>
                <p className="text-sm text-gray-500">
                  {store?.storeType === 'online' 
                    ? 'Convert your online store to include a physical location' 
                    : 'Add your physical store address'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-6 bg-blue-50 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start space-x-3">
            <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="text-blue-800 font-medium mb-1">
                {store?.storeType === 'online' ? 'Converting to Physical Store' : 'Adding Physical Location'}
              </p>
              <p className="text-blue-700">
                {store?.storeType === 'online' 
                  ? 'Your store will be converted to a physical store with an online presence. You can still manage your online channels.'
                  : 'Provide the physical address where customers can visit your store.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {errors.submit && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-gray-600" />
                  Physical Store Address
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      name="address.street"
                      value={formData.address.street}
                      onChange={handleChange}
                      placeholder="e.g., 123 Main Street, Ikeja"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-black"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        name="address.city"
                        value={formData.address.city}
                        onChange={handleChange}
                        placeholder="e.g., Lagos"
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-black ${
                          errors['address.city'] ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors['address.city'] && (
                        <p className="text-red-500 text-xs mt-1">{errors['address.city']}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        name="address.postalCode"
                        value={formData.address.postalCode}
                        onChange={handleChange}
                        placeholder="100001"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-black"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* What Changes */}
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <h4 className="text-sm font-medium text-green-800 mb-2">What will change:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Your store type will be updated to "Physical Store"</li>
                  <li>• Physical address will be displayed on receipts</li>
                  <li>• Store location will be shown to customers</li>
                  {store?.storeType === 'online' && (
                    <li>• Your online store information will be preserved</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer with Buttons */}
        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between space-x-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {store?.storeType === 'online' ? 'Converting...' : 'Adding Location...'}
                </>
              ) : (
                <>
                  <Building className="w-4 h-4 mr-2" />
                  {store?.storeType === 'online' ? 'Convert to Physical Store' : 'Add Physical Location'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
