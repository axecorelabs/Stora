"use client";
import { useState, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import CreateStoreModal from "@/components/dashboard/CreateStoreModal";
import WebsiteSettingsView from "@/components/dashboard/WebsiteSettingsView";
import WebsiteInventoryView from "@/components/dashboard/WebsiteInventoryView";
import { useWebsiteData } from "@/hooks/useWebsiteData";
import { 
  Globe, 
  Store, 
  AlertCircle, 
  Eye, 
  ExternalLink, 
  Settings, 
  Palette,
  BarChart3,
  Users,
  Copy,
  Check,
  Power,
  Edit3,
  Share2,
  Instagram,
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  Clock,
  Package
} from "lucide-react";
import StoreBrandingModal from "@/components/dashboard/StoreBrandingModal";

export default function WebsitePage() {
  const [isCreateStoreModalOpen, setIsCreateStoreModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentView, setCurrentView] = useState('main'); // 'main', 'settings', or 'inventory'
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);

  // Use TanStack Query for data fetching
  const {
    hasStore,
    store,
    storeLoading,
    isInitialLoading,
    previewProducts,
    isLoadingPreviewProducts,
    toggleWebsite,
    isTogglingWebsite,
    refetchStore,
    refetchPreviewProducts,
  } = useWebsiteData();

  // Handle store creation
  const handleStoreCreated = (newStore) => {
    setIsCreateStoreModalOpen(false);
    refetchStore();
    refetchPreviewProducts();
  };

  // Toggle website status
  const toggleWebsiteStatus = async () => {
    if (!store) return;
    
    try {
      const newStatus = store.ivmaWebsite.status === 'active' ? 'inactive' : 'active';
      await toggleWebsite(newStatus);
    } catch (error) {
      console.error('Error toggling website status:', error);
      alert('Failed to toggle website status. Please try again.');
    }
  };

  // Copy website URL
  const copyWebsiteUrl = async () => {
    if (!store?.websiteUrl) return;
    
    try {
      await navigator.clipboard.writeText(store.websiteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  // Get website status info
  const getWebsiteStatusInfo = () => {
    if (!store?.ivmaWebsite) return { color: 'gray', text: 'Not Set Up' };
    
    switch (store.ivmaWebsite.status) {
      case 'active':
        return { color: 'green', text: 'Live & Active' };
      case 'inactive':
        return { color: 'gray', text: 'Inactive' };
      case 'pending':
        return { color: 'yellow', text: 'Setting Up...' };
      case 'suspended':
        return { color: 'red', text: 'Suspended' };
      case 'maintenance':
        return { color: 'orange', text: 'Maintenance' };
      default:
        return { color: 'gray', text: 'Unknown' };
    }
  };

  const websiteStatus = getWebsiteStatusInfo();

  const handleBrandingUpdated = (updatedStore) => {
    refetchStore();
    setIsBrandingModalOpen(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Get social media links with proper formatting - memoized (returns array, not function)
  const socialMediaLinks = useMemo(() => {
    if (!store?.socialMedia) return [];

    const socialLinks = [];
    const socials = store.socialMedia;

    // WhatsApp
    if (socials.whatsapp) {
      const whatsappNumber = socials.whatsapp.replace(/\D/g, '');
      const formattedNumber = whatsappNumber.startsWith('234') ? whatsappNumber : `234${whatsappNumber.startsWith('0') ? whatsappNumber.slice(1) : whatsappNumber}`;
      
      socialLinks.push({
        platform: 'WhatsApp',
        icon: MessageCircle,
        value: socials.whatsapp,
        url: `https://wa.me/${formattedNumber}`,
        color: 'text-green-600',
        bgColor: 'bg-green-100'
      });
    }

    // Instagram
    if (socials.instagram) {
      const username = socials.instagram.replace('@', '');
      socialLinks.push({
        platform: 'Instagram',
        icon: Instagram,
        value: socials.instagram,
        url: `https://instagram.com/${username}`,
        color: 'text-pink-600',
        bgColor: 'bg-pink-100'
      });
    }

    // Facebook
    if (socials.facebook) {
      const username = socials.facebook.replace('@', '');
      socialLinks.push({
        platform: 'Facebook',
        icon: Facebook,
        value: socials.facebook,
        url: `https://facebook.com/${username}`,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100'
      });
    }

    // Twitter
    if (socials.twitter) {
      const username = socials.twitter.replace('@', '');
      socialLinks.push({
        platform: 'Twitter',
        icon: Twitter,
        value: socials.twitter,
        url: `https://twitter.com/${username}`,
        color: 'text-blue-400',
        bgColor: 'bg-blue-100'
      });
    }

    return socialLinks;
  }, [store?.socialMedia]);

  // Handle social media link click
  const handleSocialClick = (socialLink) => {
    window.open(socialLink.url, '_blank', 'noopener,noreferrer');
  };

  // Show loading skeleton only on initial load
  if (isInitialLoading) {
    return (
      <DashboardLayout title="Website Management" subtitle="Manage your online store presence">
        <div className="space-y-8">
          {/* Header Skeleton */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gray-200 rounded-2xl"></div>
                <div className="space-y-2">
                  <div className="h-6 w-32 bg-gray-200 rounded"></div>
                  <div className="h-4 w-48 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="h-10 w-48 bg-gray-200 rounded-xl"></div>
                <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
                <div className="h-6 w-40 bg-gray-200 rounded mb-6"></div>
                <div className="h-96 bg-gray-200 rounded-xl"></div>
              </div>
            </div>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
                  <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show create store prompt if no store
  if (hasStore === false) {
    return (
      <DashboardLayout title="Website Management" subtitle="Manage your online store presence">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium mb-2">Store Required</p>
            <p className="text-gray-400 text-sm mb-4">You need to set up your store first to manage your website</p>
            <button
              onClick={() => setIsCreateStoreModalOpen(true)}
              className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
            >
              Create Store
            </button>
          </div>
        </div>

        <CreateStoreModal
          isOpen={isCreateStoreModalOpen}
          onStoreCreated={handleStoreCreated}
        />
      </DashboardLayout>
    );
  }

  // Render inventory view
  if (currentView === 'inventory') {
    return (
      <DashboardLayout title="Website Management" subtitle="Manage your online store presence">
        <WebsiteInventoryView
          onBack={() => setCurrentView('main')}
          store={store}
        />
      </DashboardLayout>
    );
  }

  // Render settings view
  if (currentView === 'settings') {
    return (
      <DashboardLayout title="Website Management" subtitle="Manage your online store presence">
        <WebsiteSettingsView
          onBack={() => setCurrentView('main')}
          store={store}
          onStoreUpdated={refetchStore}
        />
      </DashboardLayout>
    );
  }

  // Main website management view - no flickering because data is cached
  return (
    <DashboardLayout title="Website Management" subtitle="Manage your online store presence">
      {/* Website Status Toggle */}
      <div className="mb-8 bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Globe className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">IVMA Store</h1>
              <div className="flex items-center space-x-3 mt-1">
                <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full bg-${websiteStatus.color}-100 text-${websiteStatus.color}-800`}>
                  {websiteStatus.text}
                </span>
                {store.websiteUrl && (
                  <span className="text-sm text-gray-500">{store.websiteFullPath}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Website URL Display */}
            {store.websiteUrl && (
              <div className="flex items-center space-x-2 bg-gray-50 rounded-xl px-4 py-2">
                <span className="text-sm text-gray-600">{store.websiteUrl}</span>
                <button
                  onClick={copyWebsiteUrl}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy URL"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <a
                  href={store.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Visit website"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Website Toggle */}
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">Website Status</span>
              <button
                onClick={toggleWebsiteStatus}
                disabled={isTogglingWebsite}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                  store.ivmaWebsite?.status === 'active'
                    ? 'bg-teal-600'
                    : 'bg-gray-200'
                } ${isTogglingWebsite ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    store.ivmaWebsite?.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              {isTogglingWebsite && (
                <div className="w-4 h-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Website Preview & Info */}
        <div className="lg:col-span-2 space-y-8">
          {/* Website Preview */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Website Preview</h2>
              {store.websiteUrl && (
                <a
                  href={store.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm text-teal-600 hover:text-teal-700 transition-colors"
                >
                  <span>View live site</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            
            {store.ivmaWebsite?.status === 'active' ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Browser Bar */}
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1.5">
                      <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
                      <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"></div>
                      <div className="w-2.5 h-2.5 bg-green-400 rounded-full"></div>
                    </div>
                    <div className="flex-1 bg-white rounded-md px-3 py-1.5 text-xs text-gray-500 flex items-center">
                      <Globe className="w-3 h-3 mr-2 text-gray-400" />
                      {store.websiteUrl}
                    </div>
                  </div>
                </div>
                
                {/* Website Content Preview */}
                <div className="bg-gray-50 min-h-[500px]">
                  {/* Hero Section with Store Info */}
                  <div 
                    className="relative px-6 py-8"
                    style={{ 
                      background: `linear-gradient(135deg, ${store.branding?.primaryColor || '#0D9488'}15 0%, ${store.branding?.primaryColor || '#0D9488'}05 100%)`
                    }}
                  >
                    {/* Banner Background */}
                    {store.branding?.banner && (
                      <div className="absolute inset-0 opacity-10">
                        <img
                          src={store.branding.banner}
                          alt="Store banner"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="relative max-w-4xl mx-auto">
                      <div className="flex items-start space-x-4 mb-6">
                        {/* Store Logo */}
                        {store.branding?.logo ? (
                          <img
                            src={store.branding.logo}
                            alt="Store logo"
                            className="w-16 h-16 object-cover rounded-2xl shadow-md ring-2 ring-white"
                          />
                        ) : (
                          <div 
                            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md ring-2 ring-white"
                            style={{ backgroundColor: store.branding?.primaryColor || '#0D9488' }}
                          >
                            <span className="text-white font-bold text-2xl">
                              {store.storeName?.charAt(0) || 'S'}
                            </span>
                          </div>
                        )}
                        
                        {/* Store Name & Description */}
                        <div className="flex-1">
                          <h1 className="text-2xl font-bold text-gray-900 mb-1">
                            {store.storeName}
                          </h1>
                          {store.storeDescription && (
                            <p className="text-sm text-gray-600 mb-3 max-w-2xl">
                              {store.storeDescription}
                            </p>
                          )}
                          
                          {/* Store Meta Info */}
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {store.storePhone && (
                              <div className="flex items-center space-x-1">
                                <Phone className="w-3 h-3" />
                                <span>{store.storePhone}</span>
                              </div>
                            )}
                            {store.storeType === 'physical' && store.address?.city && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span>{store.address.city}, {store.address.state}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Categories/Filters Bar */}
                  <div className="bg-white border-y border-gray-200 px-6 py-3">
                    <div className="max-w-4xl mx-auto flex items-center space-x-2">
                      <button className="px-4 py-1.5 bg-gray-900 text-white text-xs rounded-full font-medium">
                        All Categories
                      </button>
                      <button className="px-4 py-1.5 border border-gray-200 text-gray-700 text-xs rounded-full hover:bg-gray-50">
                        All Prices
                      </button>
                      <button className="px-4 py-1.5 border border-gray-200 text-gray-700 text-xs rounded-full hover:bg-gray-50">
                        All Products
                      </button>
                      <div className="flex-1"></div>
                      <span className="text-xs text-gray-500">{previewProducts.length} products</span>
                    </div>
                  </div>
                  
                  {/* Products Grid */}
                  <div className="px-6 py-6">
                    <div className="max-w-4xl mx-auto">
                      {isLoadingPreviewProducts ? (
                        // Products loading skeleton
                        <div className="grid grid-cols-3 gap-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
                              <div className="bg-gray-200 aspect-square"></div>
                              <div className="p-3 space-y-2">
                                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                                <div className="h-4 bg-gray-200 rounded"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                <div className="h-8 bg-gray-200 rounded mt-3"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : previewProducts.length > 0 ? (
                        <div className="grid grid-cols-3 gap-4">
                          {previewProducts.map((product, index) => (
                            <div key={product._id || index} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                              {/* Product Image */}
                              <div className="relative bg-gray-100 aspect-square overflow-hidden group">
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.productName}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                    <Package className="w-12 h-12 text-gray-300" />
                                  </div>
                                )}
                                
                                {/* Stock Badge */}
                                {product.quantityInStock <= 5 && product.quantityInStock > 0 && (
                                  <div className="absolute top-2 left-2">
                                    <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded-md">
                                      Low Stock
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Product Info */}
                              <div className="p-3">
                                <div className="mb-2">
                                  {product.category && (
                                    <span className="text-xs text-gray-500">{product.category}</span>
                                  )}
                                </div>
                                <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2 min-h-[2.5rem]" title={product.productName}>
                                  {product.productName}
                                </h3>
                                
                                {/* Price & Stock */}
                                <div className="flex items-center justify-between mt-2">
                                  <div>
                                    <p className="font-bold text-gray-900 text-base">
                                      {formatCurrency(product.sellingPrice)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {product.quantityInStock} in stock
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Add to Cart Button */}
                                <button 
                                  className="w-full mt-3 px-3 py-2 text-xs font-medium text-white rounded-lg transition-colors"
                                  style={{ backgroundColor: store.branding?.primaryColor || '#0D9488' }}
                                >
                                  Add to Cart
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Empty State
                        <div className="grid grid-cols-3 gap-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                              <div className="bg-gray-100 aspect-square flex items-center justify-center">
                                <Package className="w-12 h-12 text-gray-300" />
                              </div>
                              <div className="p-3">
                                <div className="mb-2">
                                  <span className="text-xs text-gray-400">Sample Category</span>
                                </div>
                                <h3 className="font-medium text-gray-900 text-sm mb-1">
                                  Sample Product {i}
                                </h3>
                                <div className="flex items-center justify-between mt-2">
                                  <div>
                                    <p className="font-bold text-gray-900 text-base">₦5,000</p>
                                    <p className="text-xs text-gray-500">In stock</p>
                                  </div>
                                </div>
                                <button 
                                  className="w-full mt-3 px-3 py-2 text-xs font-medium text-white rounded-lg"
                                  style={{ backgroundColor: store.branding?.primaryColor || '#0D9488' }}
                                >
                                  Add to Cart
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add products notice */}
                      {previewProducts.length === 0 && !isLoadingPreviewProducts && (
                        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                          <p className="text-blue-800 text-xs text-center">
                            <strong>Preview Mode:</strong> Add products to your inventory to see them displayed here.
                            <a href="/dashboard/inventory" className="ml-1 underline hover:text-blue-900 font-medium">
                              Add products now →
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Footer Preview */}
                  <div className="bg-white border-t border-gray-200 px-6 py-6 mt-8">
                    <div className="max-w-4xl mx-auto text-center">
                      <p className="text-xs text-gray-500">
                        © {new Date().getFullYear()} {store.storeName}. All rights reserved.
                      </p>
                      {socialMediaLinks.length > 0 && (
                        <div className="flex items-center justify-center space-x-3 mt-3">
                          {socialMediaLinks.slice(0, 3).map((social, idx) => {
                            const IconComponent = social.icon;
                            return (
                              <div key={idx} className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                                <IconComponent className="w-3 h-3 text-gray-500" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-500 mb-2">Website Inactive</h3>
                <p className="text-gray-400 mb-4">Turn on your website to see the preview</p>
                <button
                  onClick={toggleWebsiteStatus}
                  disabled={isTogglingWebsite}
                  className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {isTogglingWebsite ? 'Activating...' : 'Activate Website'}
                </button>
              </div>
            )}
          </div>

          {/* Store Information Display */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Store Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-700 mb-3">Basic Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Store className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium text-gray-600">{store.storeName}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium capitalize text-gray-600">{store.storeType}</span>
                  </div>
                  {store.storePhone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium text-gray-600">{store.storePhone}</span>
                    </div>
                  )}
                  {store.storeEmail && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium text-gray-600">{store.storeEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-3">
                  {store.storeType === 'physical' ? 'Location' : 'Online Presence'}
                </h3>
                <div className="space-y-2 text-sm">
                  {store.storeType === 'physical' ? (
                    <>
                      {store.fullAddress && (
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                          <div>
                            <span className="text-gray-600">Address:</span>
                            <p className="font-medium">{store.fullAddress}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {store.onlineStoreInfo?.website && (
                        <div className="flex items-center space-x-2">
                          <Globe className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">Website:</span>
                          <span className="font-medium">{store.onlineStoreInfo.website}</span>
                        </div>
                      )}
                      {store.onlineStoreInfo?.socialMedia?.instagram && (
                        <div className="flex items-center space-x-2">
                          <Instagram className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">Instagram:</span>
                          <span className="font-medium text-gray-600">{store.onlineStoreInfo.socialMedia.instagram}</span>
                        </div>
                      )}
                      {store.onlineStoreInfo?.socialMedia?.whatsapp && (
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">WhatsApp:</span>
                          <span className="font-medium text-gray-600">{store.onlineStoreInfo.socialMedia.whatsapp}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Stats & Actions */}
        <div className="space-y-6">
          {/* Website Stats */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Website Statistics</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Eye className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-600">Total Views</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {store.ivmaWebsite?.metrics?.totalViews || 0}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-600">Monthly Views</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {store.ivmaWebsite?.metrics?.monthlyViews || 0}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-600">Total Orders</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {store.ivmaWebsite?.metrics?.totalOrders || 0}
                </span>
              </div>

              {/* <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Package className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-600">Products Listed</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {previewProducts.length}
                </span>
              </div> */}
              
              {store.ivmaWebsite?.metrics?.lastVisit && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="text-sm text-gray-600">Last Visit</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(store.ivmaWebsite.metrics.lastVisit).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Products info */}
            {previewProducts.length === 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-yellow-800 text-xs">
                  <strong>No products to display:</strong> Add inventory items to showcase them on your website.
                </p>
              </div>
            )}
          </div>

          {/* Social Media Links */}
          {socialMediaLinks.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Share2 className="w-5 h-5 mr-2" />
                Social Media Links
              </h3>
              <div className="space-y-3">
                {socialMediaLinks.map((social, index) => {
                  const IconComponent = social.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSocialClick(social)}
                      className={`w-full flex items-center justify-between p-3 ${social.bgColor} rounded-xl hover:opacity-80 transition-all group`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 bg-white rounded-lg ${social.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-medium ${social.color}`}>
                            {social.platform}
                          </p>
                          <p className="text-xs text-gray-600">
                            {social.value}
                          </p>
                        </div>
                      </div>
                      <ExternalLink className={`w-4 h-4 ${social.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-600 flex items-center">
                  <Info className="w-3 h-3 mr-1" />
                  Click any social media link to visit your store's profile on that platform
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button 
                onClick={() => setIsBrandingModalOpen(true)}
                className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
              >
                <Palette className="w-4 h-4 mr-2" />
                Customize Design
              </button>
              
              <button 
                onClick={() => setCurrentView('inventory')}
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Package className="w-4 h-4 mr-2" />
                Manage Website Inventory
              </button>
              
              <button 
                onClick={() => setCurrentView('settings')}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-4 h-4 mr-2" />
                Website Settings
              </button>
              
              {/* Share & Promote with Social Media dropdown */}
              {socialMediaLinks.length > 0 ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsShareDropdownOpen(!isShareDropdownOpen)}
                    className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share & Promote
                    <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isShareDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isShareDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                      {socialMediaLinks.map((social, index) => {
                        const IconComponent = social.icon;
                        return (
                          <button
                            key={index}
                            onClick={() => {
                              handleSocialClick(social);
                              setIsShareDropdownOpen(false);
                            }}
                            className={`w-full flex items-center px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl ${social.color}`}
                          >
                            <IconComponent className="w-4 h-4 mr-3" />
                            <span className="text-sm">Visit {social.platform}</span>
                            <ExternalLink className="w-3 h-3 ml-auto" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <button className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share & Promote
                </button>
              )}
              
              {store?.ivmaWebsite?.url && (
                <button
                  onClick={() => window.open(store.ivmaWebsite.url, '_blank')}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Website
                </button>
              )}
            </div>

            {/* Customization Tips */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Customization Tips
              </h4>
              <div className="text-xs text-blue-800 space-y-2">
                <p>
                  <strong>Design & Branding:</strong> Use "Customize Design" to update your store logo, banner, and brand colors.
                </p>
                {/* <p>
                  <strong>Advanced Layout:</strong> Visit <button 
                    onClick={() => setCurrentView('settings')}
                    className="underline hover:text-blue-900 font-medium"
                  >
                    Website Settings
                  </button> → "Appearance & Layout" for themes, product layouts, and more customization options.
                </p> */}
                <p>
                  <strong>Product Display:</strong> Control what products appear on your website using "Manage Website Inventory".
                </p>
                {socialMediaLinks.length > 0 && (
                  <p>
                    <strong>Social Media:</strong> Share your website on your social media platforms to drive more traffic and sales.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Website Status Info */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Information</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current Status</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${websiteStatus.color}-100 text-${websiteStatus.color}-800`}>
                  {websiteStatus.text}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Website Path</span>
                <span className="text-sm font-medium text-gray-900">
                  {store.websiteFullPath || 'Not assigned'}
                </span>
              </div>
              
              {store.ivmaWebsite?.activatedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Activated</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(store.ivmaWebsite.activatedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              {store.ivmaWebsite?.lastPublishedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Updated</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(store.ivmaWebsite.lastPublishedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Store Modal */}
      <CreateStoreModal
        isOpen={isCreateStoreModalOpen}
        onStoreCreated={handleStoreCreated}
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
