"use client";
import { useState, useRef, useEffect } from "react";
import { X, Upload, Image as ImageIcon, Palette, Save, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function StoreBrandingModal({ isOpen, onClose, onBrandingUpdated, store }) {
  const { secureFormDataCall } = useAuth();
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    primaryColor: '#0D9488',
    secondaryColor: '#F3F4F6'
  });
  const [logoFile, setLogoFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Initialize form data when store data is available
  useEffect(() => {
    if (store?.branding) {
      setFormData({
        primaryColor: store.branding.primaryColor || '#0D9488',
        secondaryColor: store.branding.secondaryColor || '#F3F4F6'
      });
      setLogoPreview(store.branding.logo);
      setBannerPreview(store.branding.banner);
    }
  }, [store]);

  const handleColorChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileSelect = (type, file) => {
    // Validate file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, [type]: 'Only JPEG, PNG, and WebP images are allowed' }));
      return;
    }

    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, [type]: 'Image size must be less than 5MB' }));
      return;
    }

    // Set file and preview
    if (type === 'logo') {
      setLogoFile(file);
      setErrors(prev => ({ ...prev, logo: '' }));
    } else {
      setBannerFile(file);
      setErrors(prev => ({ ...prev, banner: '' }));
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'logo') {
        setLogoPreview(e.target.result);
      } else {
        setBannerPreview(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeFile = (type) => {
    if (type === 'logo') {
      setLogoFile(null);
      setLogoPreview(store?.branding?.logo || null);
      if (logoInputRef.current) logoInputRef.current.value = '';
    } else {
      setBannerFile(null);
      setBannerPreview(store?.branding?.banner || null);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    setErrors({});
    setUploadProgress({});

    try {
      const formDataToSend = new FormData();
      
      // Add color data
      formDataToSend.append('primaryColor', formData.primaryColor);
      formDataToSend.append('secondaryColor', formData.secondaryColor);
      
      // Add files if selected
      if (logoFile) {
        formDataToSend.append('logo', logoFile);
        setUploadProgress(prev => ({ ...prev, logo: 'Uploading logo...' }));
      }
      
      if (bannerFile) {
        formDataToSend.append('banner', bannerFile);
        setUploadProgress(prev => ({ ...prev, banner: 'Uploading banner...' }));
      }

      const response = await secureFormDataCall('/api/stores/branding', formDataToSend, {
        method: 'PUT'
      });

      if (response.success) {
        onBrandingUpdated(response.data);
        setLogoFile(null);
        setBannerFile(null);
        setErrors({});
        setUploadProgress({});
        onClose();
      } else {
        setErrors({ submit: response.message || 'Failed to update branding' });
      }
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to update branding' });
    } finally {
      setIsSubmitting(false);
      setUploadProgress({});
    }
  };

  const resetForm = () => {
    if (store?.branding) {
      setFormData({
        primaryColor: store.branding.primaryColor || '#0D9488',
        secondaryColor: store.branding.secondaryColor || '#F3F4F6'
      });
      setLogoPreview(store.branding.logo);
      setBannerPreview(store.branding.banner);
    }
    setLogoFile(null);
    setBannerFile(null);
    setErrors({});
    setUploadProgress({});
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Palette className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Store Branding</h2>
              <p className="text-sm text-gray-500">Customize your store's visual identity</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6">
            {errors.submit && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Side - Upload Section */}
              <div className="space-y-6">
                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Store Logo
                  </label>
                  <p className="text-xs text-gray-500 mb-4">
                    Upload a square logo for your store. Recommended size: 200x200px
                  </p>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                    {logoPreview ? (
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="w-24 h-24 object-cover rounded-xl border border-gray-200"
                          />
                        </div>
                        <div className="flex justify-center space-x-2">
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Change Logo
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFile('logo')}
                            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        className="cursor-pointer"
                      >
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-1">Click to upload logo</p>
                        <p className="text-xs text-gray-400">PNG, JPG, WebP up to 5MB</p>
                      </div>
                    )}
                  </div>
                  
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files[0] && handleFileSelect('logo', e.target.files[0])}
                    className="hidden"
                  />
                  
                  {errors.logo && (
                    <p className="text-red-500 text-xs mt-2">{errors.logo}</p>
                  )}
                  {uploadProgress.logo && (
                    <p className="text-blue-600 text-xs mt-2">{uploadProgress.logo}</p>
                  )}
                </div>

                {/* Banner Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Store Banner
                  </label>
                  <p className="text-xs text-gray-500 mb-4">
                    Upload a banner image for your store. Recommended size: 1200x400px
                  </p>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                    {bannerPreview ? (
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <img
                            src={bannerPreview}
                            alt="Banner preview"
                            className="w-full max-w-sm h-24 object-cover rounded-xl border border-gray-200"
                          />
                        </div>
                        <div className="flex justify-center space-x-2">
                          <button
                            type="button"
                            onClick={() => bannerInputRef.current?.click()}
                            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Change Banner
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFile('banner')}
                            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => bannerInputRef.current?.click()}
                        className="cursor-pointer"
                      >
                        <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-1">Click to upload banner</p>
                        <p className="text-xs text-gray-400">PNG, JPG, WebP up to 5MB</p>
                      </div>
                    )}
                  </div>
                  
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files[0] && handleFileSelect('banner', e.target.files[0])}
                    className="hidden"
                  />
                  
                  {errors.banner && (
                    <p className="text-red-500 text-xs mt-2">{errors.banner}</p>
                  )}
                  {uploadProgress.banner && (
                    <p className="text-blue-600 text-xs mt-2">{uploadProgress.banner}</p>
                  )}
                </div>
              </div>

              {/* Right Side - Colors and Preview */}
              <div className="space-y-6">
                {/* Color Palette */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Brand Colors
                  </label>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Primary Color</label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={formData.primaryColor}
                          onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                          className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.primaryColor}
                          onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-black text-sm"
                          placeholder="#0D9488"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Secondary Color</label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={formData.secondaryColor}
                          onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                          className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.secondaryColor}
                          onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-black text-sm"
                          placeholder="#F3F4F6"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </label>
                  
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Banner Preview */}
                    {bannerPreview && (
                      <div className="relative h-24 overflow-hidden">
                        <img
                          src={bannerPreview}
                          alt="Banner preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20"></div>
                      </div>
                    )}
                    
                    {/* Store Header Preview */}
                    <div className="p-4" style={{ backgroundColor: formData.secondaryColor }}>
                      <div className="flex items-center space-x-3">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: formData.primaryColor }}
                          >
                            <span className="text-white font-bold text-sm">
                              {store?.storeName?.charAt(0) || 'S'}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {store?.storeName || 'Your Store Name'}
                          </h3>
                          <p className="text-xs text-gray-600">
                            {store?.storeDescription || 'Store description'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Sample elements with primary color */}
                      <div className="mt-4 flex space-x-2">
                        <button 
                          className="px-4 py-2 text-white text-sm rounded-lg font-medium"
                          style={{ backgroundColor: formData.primaryColor }}
                        >
                          Shop Now
                        </button>
                        <button 
                          className="px-4 py-2 text-sm rounded-lg font-medium border"
                          style={{ 
                            borderColor: formData.primaryColor,
                            color: formData.primaryColor
                          }}
                        >
                          Learn More
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Color Presets */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Quick Presets
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { primary: '#0D9488', secondary: '#F3F4F6', name: 'Teal' },
                      { primary: '#3B82F6', secondary: '#EFF6FF', name: 'Blue' },
                      { primary: '#10B981', secondary: '#F0FDF4', name: 'Green' },
                      { primary: '#8B5CF6', secondary: '#FAF5FF', name: 'Purple' },
                      { primary: '#F59E0B', secondary: '#FFFBEB', name: 'Orange' },
                      { primary: '#EF4444', secondary: '#FEF2F2', name: 'Red' },
                      { primary: '#6B7280', secondary: '#F9FAFB', name: 'Gray' },
                      { primary: '#EC4899', secondary: '#FDF2F8', name: 'Pink' }
                    ].map((preset, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setFormData({
                          primaryColor: preset.primary,
                          secondaryColor: preset.secondary
                        })}
                        className="group relative p-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                        title={preset.name}
                      >
                        <div className="flex space-x-1">
                          <div 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: preset.primary }}
                          ></div>
                          <div 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: preset.secondary }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600 mt-1 block group-hover:text-gray-900">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Updating Branding...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Branding
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
