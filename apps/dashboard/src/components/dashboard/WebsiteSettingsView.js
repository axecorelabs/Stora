"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ArrowLeft,
  Save,
  Globe,
  Eye,
  Settings,
  Palette,
  Search,
  Share2,
  Bell,
  Shield,
  Code,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  XCircle
} from "lucide-react";
import CustomDropdown from "../ui/CustomDropdown";

const STORE_APEX_DOMAIN = (process.env.NEXT_PUBLIC_STORE_URL || 'https://stora.com.ng').replace(/^https?:\/\//, '');

export default function WebsiteSettingsView({ onBack, store, onStoreUpdated }) {
  const { secureApiCall } = useAuth();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Separate from `settings`/`errors` above -- this has its own async,
  // debounced, DB-hitting check, unlike everything else on this page.
  const [websitePathInput, setWebsitePathInput] = useState('');
  // 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unchanged'
  const [websitePathStatus, setWebsitePathStatus] = useState('idle');
  const [websitePathReason, setWebsitePathReason] = useState('');

  // Theme options
  const themeOptions = [
    { value: 'default', label: 'Default Theme' },
    { value: 'modern', label: 'Modern' },
    { value: 'classic', label: 'Classic' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'bold', label: 'Bold' }
  ];

  // Layout options
  const layoutOptions = [
    { value: 'grid', label: 'Grid Layout' },
    { value: 'list', label: 'List Layout' },
    { value: 'masonry', label: 'Masonry Layout' },
    { value: 'slider', label: 'Slider Layout' }
  ];

  // Load current settings
  useEffect(() => {
    if (store?.website) {
      setSettings({
        // SEO Settings
        metaTitle: store.website.seoSettings?.metaTitle || '',
        metaDescription: store.website.seoSettings?.metaDescription || '',
        keywords: store.website.seoSettings?.keywords?.join(', ') || '',
        
        // Customization
        theme: store.website.customization?.theme || 'default',
        layout: store.website.customization?.layout || 'grid',
        showInventory: store.website.customization?.showInventory ?? true,
        showPrices: store.website.customization?.showPrices ?? true,
        enableWhatsAppOrder: store.website.customization?.enableWhatsAppOrder ?? true,
        enableDirectPurchase: store.website.customization?.enableDirectPurchase ?? false,
        
        // Analytics
        isGoogleAnalyticsEnabled: store.website.analytics?.isGoogleAnalyticsEnabled ?? false,
        googleAnalyticsId: store.website.analytics?.googleAnalyticsId || '',
        trackingCode: store.website.analytics?.trackingCode || '',
        
        // Domain
        customDomain: store.website.domain?.customDomain || '',
        sslEnabled: store.website.domain?.sslEnabled ?? true,
        
        // Website Features
        contactForm: store.website.settings?.contactForm ?? true,
        socialMediaLinks: store.website.settings?.socialMediaLinks ?? true,
        storeHours: store.website.settings?.storeHours ?? true,
        locationMap: store.website.settings?.locationMap ?? true,
        testimonials: store.website.settings?.testimonials ?? false,
        blog: store.website.settings?.blog ?? false
      });
      setWebsitePathInput(store.websitePath || '');
      setWebsitePathStatus('idle');
      setLoading(false);
    }
  }, [store]);

  // Debounced (400ms) live availability check, same pattern as
  // CreateStoreModal's store-name warning -- including the `cancelled`
  // guard, which fixed a real bug there (a slower, older check response
  // landing after a newer one and overwriting it with a stale result).
  useEffect(() => {
    const normalized = websitePathInput.trim().toLowerCase();
    const currentlyResolvedPath = store?.websitePath || '';
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      if (!normalized || normalized === currentlyResolvedPath) {
        setWebsitePathStatus(normalized ? 'unchanged' : 'invalid');
        setWebsitePathReason(normalized ? '' : 'Website address is required');
        return;
      }

      setWebsitePathStatus('checking');
      try {
        const response = await secureApiCall(`/api/stores/website/check-path?path=${encodeURIComponent(normalized)}`);
        if (cancelled) return;
        if (response?.available) {
          setWebsitePathStatus('available');
          setWebsitePathReason('');
        } else {
          setWebsitePathStatus('taken');
          setWebsitePathReason(response?.reason || 'Not available');
        }
      } catch (error) {
        if (!cancelled) {
          setWebsitePathStatus('idle');
          setWebsitePathReason('');
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websitePathInput]);

  const handleWebsitePathChange = (value) => {
    setWebsitePathInput(value);
    if (successMessage) setSuccessMessage('');
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear errors when user makes changes
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const validateSettings = () => {
    const newErrors = {};
    
    if (settings.metaTitle && settings.metaTitle.length > 60) {
      newErrors.metaTitle = 'Meta title should not exceed 60 characters';
    }
    
    if (settings.metaDescription && settings.metaDescription.length > 160) {
      newErrors.metaDescription = 'Meta description should not exceed 160 characters';
    }
    
    if (settings.isGoogleAnalyticsEnabled && !settings.googleAnalyticsId.trim()) {
      newErrors.googleAnalyticsId = 'Google Analytics ID is required when analytics is enabled';
    }
    
    if (settings.customDomain && !/^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$/.test(settings.customDomain)) {
      newErrors.customDomain = 'Please enter a valid domain name';
    }

    // websitePathStatus is either the answer to "is this free" (available)
    // or "nothing changed, keep what's already saved" (unchanged) --
    // anything else (still checking, taken, or plain invalid) means this
    // isn't in a savable state yet.
    if (websitePathStatus !== 'available' && websitePathStatus !== 'unchanged') {
      newErrors.websitePath = websitePathReason || 'Please wait for the availability check to finish';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) return;
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const updateData = {
        website: {
          ...store.website,
          websitePath: websitePathInput.trim().toLowerCase(),
          seoSettings: {
            metaTitle: settings.metaTitle,
            metaDescription: settings.metaDescription,
            keywords: settings.keywords ? settings.keywords.split(',').map(k => k.trim()).filter(k => k) : []
          },
          customization: {
            theme: settings.theme,
            layout: settings.layout,
            showInventory: settings.showInventory,
            showPrices: settings.showPrices,
            enableWhatsAppOrder: settings.enableWhatsAppOrder,
            enableDirectPurchase: settings.enableDirectPurchase
          },
          analytics: {
            isGoogleAnalyticsEnabled: settings.isGoogleAnalyticsEnabled,
            googleAnalyticsId: settings.googleAnalyticsId,
            trackingCode: settings.trackingCode
          },
          domain: {
            customDomain: settings.customDomain,
            sslEnabled: settings.sslEnabled
          },
          settings: {
            contactForm: settings.contactForm,
            socialMediaLinks: settings.socialMediaLinks,
            storeHours: settings.storeHours,
            locationMap: settings.locationMap,
            testimonials: settings.testimonials,
            blog: settings.blog
          },
          lastPublishedAt: new Date()
        }
      };

      const response = await secureApiCall('/api/stores/website/settings', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response.success) {
        onStoreUpdated(response.data);
        setSuccessMessage('Website settings updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ submit: response.message || 'Failed to update website settings' });
      }
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to update website settings' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading website settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Website</span>
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Website Settings</h1>
            <p className="text-gray-500">Customize your website appearance and functionality</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {store?.websiteUrl && (
            <a
              href={store.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center space-x-2 px-6 py-2 bg-brand-800 text-white rounded-xl hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800 font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{errors.submit}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-8">
          {/* Website Address */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <Globe className="w-5 h-5 mr-2 text-gray-600" />
              Website Address
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose your own, or keep the one generated from your store name
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={websitePathInput}
                  onChange={(e) => handleWebsitePathChange(e.target.value.toLowerCase())}
                  placeholder="your-store-name"
                  className={`flex-1 min-w-0 px-4 py-3 border rounded-l-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                    errors.websitePath ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                <span className="px-4 py-3 border border-l-0 border-gray-300 rounded-r-xl bg-gray-50 text-gray-500 text-sm whitespace-nowrap">
                  .{STORE_APEX_DOMAIN}
                </span>
              </div>

              <div className="mt-2 min-h-[20px]">
                {websitePathStatus === 'checking' && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Checking availability…
                  </p>
                )}
                {websitePathStatus === 'available' && (
                  <p className="text-xs text-green-600 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Available
                  </p>
                )}
                {websitePathStatus === 'unchanged' && (
                  <p className="text-xs text-gray-400">This is your current address</p>
                )}
                {(websitePathStatus === 'taken' || websitePathStatus === 'invalid') && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    {websitePathReason}
                  </p>
                )}
                {errors.websitePath && websitePathStatus !== 'taken' && websitePathStatus !== 'invalid' && (
                  <p className="text-xs text-red-600">{errors.websitePath}</p>
                )}
              </div>
            </div>
          </div>

          {/* SEO Settings */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <Search className="w-5 h-5 mr-2 text-gray-600" />
              SEO & Search Engine Optimization
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Title
                </label>
                <input
                  type="text"
                  value={settings.metaTitle}
                  onChange={(e) => handleChange('metaTitle', e.target.value)}
                  placeholder="Your Store Name - Quality Products Online"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                    errors.metaTitle ? 'border-red-300' : 'border-gray-300'
                  }`}
                  maxLength={60}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">Appears in search engine results</p>
                  <p className="text-xs text-gray-500">{settings.metaTitle.length}/60</p>
                </div>
                {errors.metaTitle && (
                  <p className="text-red-500 text-xs mt-1">{errors.metaTitle}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Description
                </label>
                <textarea
                  value={settings.metaDescription}
                  onChange={(e) => handleChange('metaDescription', e.target.value)}
                  placeholder="Discover quality products at great prices. Shop now for fast delivery and excellent customer service."
                  rows={3}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                    errors.metaDescription ? 'border-red-300' : 'border-gray-300'
                  }`}
                  maxLength={160}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">Short description for search results</p>
                  <p className="text-xs text-gray-500">{settings.metaDescription.length}/160</p>
                </div>
                {errors.metaDescription && (
                  <p className="text-red-500 text-xs mt-1">{errors.metaDescription}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords
                </label>
                <input
                  type="text"
                  value={settings.keywords}
                  onChange={(e) => handleChange('keywords', e.target.value)}
                  placeholder="electronics, fashion, accessories, quality products"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                />
                <p className="text-xs text-gray-500 mt-1">Separate keywords with commas</p>
              </div>
            </div>
          </div>

          {/* Appearance & Layout */}
          {/* <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <Palette className="w-5 h-5 mr-2 text-gray-600" />
              Appearance & Layout
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme
                </label>
                <CustomDropdown
                  options={themeOptions}
                  value={settings.theme}
                  onChange={(value) => handleChange('theme', value)}
                  placeholder="Select theme"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Layout
                </label>
                <CustomDropdown
                  options={layoutOptions}
                  value={settings.layout}
                  onChange={(value) => handleChange('layout', value)}
                  placeholder="Select layout"
                />
              </div>
            </div>
          </div> */}

          {/* Product Display Settings */}
          {/* <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-gray-600" />
              Product Display Settings
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Show Inventory Items</h3>
                  <p className="text-sm text-gray-500">Display your products on the website</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showInventory}
                    onChange={(e) => handleChange('showInventory', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Show Prices</h3>
                  <p className="text-sm text-gray-500">Display product prices to visitors</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showPrices}
                    onChange={(e) => handleChange('showPrices', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">WhatsApp Ordering</h3>
                  <p className="text-sm text-gray-500">Allow customers to order via WhatsApp</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableWhatsAppOrder}
                    onChange={(e) => handleChange('enableWhatsAppOrder', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Direct Purchase</h3>
                  <p className="text-sm text-gray-500">Enable direct online purchasing (Coming Soon)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer opacity-50">
                  <input
                    type="checkbox"
                    checked={settings.enableDirectPurchase}
                    onChange={(e) => handleChange('enableDirectPurchase', e.target.checked)}
                    disabled
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>
            </div>
          </div> */}

          {/* Analytics */}
          {/* <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <Share2 className="w-5 h-5 mr-2 text-gray-600" />
              Analytics & Tracking
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Google Analytics</h3>
                  <p className="text-sm text-gray-500">Track website visitors and behavior</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.isGoogleAnalyticsEnabled}
                    onChange={(e) => handleChange('isGoogleAnalyticsEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>

              {settings.isGoogleAnalyticsEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Google Analytics ID
                  </label>
                  <input
                    type="text"
                    value={settings.googleAnalyticsId}
                    onChange={(e) => handleChange('googleAnalyticsId', e.target.value)}
                    placeholder="G-XXXXXXXXXX or UA-XXXXXXXXX"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                      errors.googleAnalyticsId ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.googleAnalyticsId && (
                    <p className="text-red-500 text-xs mt-1">{errors.googleAnalyticsId}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Tracking Code
                </label>
                <textarea
                  value={settings.trackingCode}
                  onChange={(e) => handleChange('trackingCode', e.target.value)}
                  placeholder="<!-- Additional tracking scripts -->"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Add custom tracking scripts (Facebook Pixel, etc.)</p>
              </div>
            </div>
          </div> */}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Domain Settings */}
          {/* <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Globe className="w-5 h-5 mr-2 text-gray-600" />
              Domain Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Domain
                </label>
                <input
                  type="text"
                  value={settings.customDomain}
                  onChange={(e) => handleChange('customDomain', e.target.value)}
                  placeholder="shop.yourdomain.com"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                    errors.customDomain ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.customDomain && (
                  <p className="text-red-500 text-xs mt-1">{errors.customDomain}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Coming Soon - Pro Feature</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">SSL Enabled</h4>
                  <p className="text-xs text-gray-500">Secure connection (HTTPS)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sslEnabled}
                    onChange={(e) => handleChange('sslEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>
            </div>
          </div> */}

          {/* Website Features */}
          {/* <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-gray-600" />
              Website Features
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Contact Form</h4>
                  <p className="text-xs text-gray-500">Allow customer inquiries</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.contactForm}
                    onChange={(e) => handleChange('contactForm', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Social Media Links</h4>
                  <p className="text-xs text-gray-500">Show social links</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.socialMediaLinks}
                    onChange={(e) => handleChange('socialMediaLinks', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Store Hours</h4>
                  <p className="text-xs text-gray-500">Display opening hours</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.storeHours}
                    onChange={(e) => handleChange('storeHours', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Location Map</h4>
                  <p className="text-xs text-gray-500">Show store location</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.locationMap}
                    onChange={(e) => handleChange('locationMap', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between opacity-50">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Testimonials</h4>
                  <p className="text-xs text-gray-500">Customer reviews (Coming Soon)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.testimonials}
                    onChange={(e) => handleChange('testimonials', e.target.checked)}
                    disabled
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between opacity-50">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Blog</h4>
                  <p className="text-xs text-gray-500">Content marketing (Coming Soon)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.blog}
                    onChange={(e) => handleChange('blog', e.target.checked)}
                    disabled
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
                </label>
              </div>
            </div>
          </div> */}

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            
            <div className="space-y-3">
              {store?.websiteUrl && (
                <a
                  href={store.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center px-4 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Live Website
                </a>
              )}
              
              {/* <button className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
                <Code className="w-4 h-4 mr-2" />
                Export Settings
              </button>
              
              <button className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
                <Bell className="w-4 h-4 mr-2" />
                Setup Notifications
              </button> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
