'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Instagram, 
  Facebook, 
  Twitter, 
  MessageCircle,
  Globe,
  Heart,
  ShoppingBag,
  Package,
  ArrowUp
} from 'lucide-react';
import useStoreStore from '@/stores/storeStore';

export default function StoreFooter() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentStore } = useStoreStore();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Screen size detection function
  const detectScreenSize = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768; // 768px is the md breakpoint in Tailwind
    }
    return false;
  };

  // Screen size detection effect - MOVED TO TOP
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(detectScreenSize());
    };

    // Set initial value
    setIsMobile(detectScreenSize());

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Extract store slug from pathname
  const storeSlug = pathname.split('/')[1];

  // Store colors with fallbacks
  const primaryColor = currentStore?.branding?.primaryColor || '#0D9488';
  const secondaryColor = currentStore?.branding?.secondaryColor || '#F3F4F6';

  // Scroll to top functionality
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle social media links
  const openSocialLink = (platform, handle) => {
    if (!handle) return;
    
    let url = '';
    switch (platform) {
      case 'instagram':
        url = `https://instagram.com/${handle.replace('@', '')}`;
        break;
      case 'facebook':
        url = `https://facebook.com/${handle.replace('@', '')}`;
        break;
      case 'twitter':
        url = `https://twitter.com/${handle.replace('@', '')}`;
        break;
      case 'whatsapp':
        // Clean phone number and format for WhatsApp
        const cleanPhone = handle.replace(/\s/g, '').replace(/^0/, '234');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;
        url = `https://wa.me/${formattedPhone}`;
        break;
      case 'website':
        url = handle.startsWith('http') ? handle : `https://${handle}`;
        break;
    }
    
    if (url) {
      window.open(url, '_blank');
    }
  };

  // Early return AFTER all hooks
  if (!currentStore) return null;

  const quickLinks = [
    { label: 'Browse Products', path: `/${storeSlug}`, icon: Package },
    { label: 'My Cart', path: `/${storeSlug}/cart`, icon: ShoppingBag },
    { label: 'Wishlist', path: `/${storeSlug}/wishlist`, icon: Heart },
    { label: 'My Orders', path: `/${storeSlug}/orders`, icon: Package },
  ];

  const socialMediaLinks = [
    { 
      platform: 'instagram', 
      handle: currentStore.onlineStoreInfo?.socialMedia?.instagram,
      icon: Instagram 
    },
    { 
      platform: 'facebook', 
      handle: currentStore.onlineStoreInfo?.socialMedia?.facebook,
      icon: Facebook 
    },
    { 
      platform: 'twitter', 
      handle: currentStore.onlineStoreInfo?.socialMedia?.twitter,
      icon: Twitter 
    },
    { 
      platform: 'whatsapp', 
      handle: currentStore.onlineStoreInfo?.socialMedia?.whatsapp || currentStore.storePhone,
      icon: MessageCircle 
    },
    { 
      platform: 'website', 
      handle: currentStore.onlineStoreInfo?.website,
      icon: Globe 
    },
  ].filter(link => link.handle && link.handle.trim() !== '');

  return (
    <footer className="bg-gray-100 border-t border-gray-100 mt-auto" >
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Store Information - Takes up more space */}
          <div className="lg:col-span-5">
            {/* Store Logo & Name */}
            <div className="flex items-center gap-3 mb-4">
              {currentStore.branding?.logo ? (
                <img 
                  src={currentStore.branding.logo} 
                  alt={currentStore.storeName} 
                  className="h-12 w-auto object-contain rounded-full" 
                />
              ) : (
                <div 
                  className="h-12 w-12 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="text-white font-bold text-xl">
                    {currentStore.storeName?.charAt(0)?.toUpperCase() || 'S'}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-display text-xl font-semibold text-gray-900">
                  {currentStore.storeName}
                </h3>
                {/* <span 
                  className="inline-block text-xs px-2 py-0.5 rounded-full mt-1"
                  style={{ 
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor 
                  }}
                >
                  {currentStore.storeType === 'physical' ? '🏪 Physical Store' : '🌐 Online Store'}
                </span> */}
              </div>
            </div>

            {/* Store Description */}
            {currentStore.storeDescription && (
              <p className="text-gray-600 mb-6 leading-relaxed text-sm">
                {currentStore.storeDescription}
              </p>
            )}

            {/* Social Media Links - Moved here for better prominence */}
            {socialMediaLinks.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
                  Connect With Us
                </p>
                <div className="flex flex-wrap gap-2">
                  {socialMediaLinks.map((social, index) => {
                    const IconComponent = social.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => openSocialLink(social.platform, social.handle)}
                        className="w-10 h-10 rounded-lg flex items-center justify-center border transition-all duration-200 group hover:shadow-md"
                        style={{ 
                          borderColor: `${primaryColor}30`,
                          backgroundColor: 'white'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${primaryColor}10`;
                          e.currentTarget.style.borderColor = primaryColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = `${primaryColor}30`;
                        }}
                        title={social.platform}
                      >
                        <IconComponent 
                          className="w-5 h-5 transition-transform group-hover:scale-110"
                          style={{ color: primaryColor }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-3">
            <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link, index) => {
                const IconComponent = link.icon;
                return (
                  <li key={index}>
                    <button
                      onClick={() => router.push(link.path)}
                      className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors group w-full text-left"
                    >
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:shadow-sm"
                        style={{ 
                          backgroundColor: `${primaryColor}10`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${primaryColor}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `${primaryColor}10`;
                        }}
                      >
                        <IconComponent 
                          className="w-4 h-4 transition-transform group-hover:scale-110" 
                          style={{ color: primaryColor }}
                        />
                      </div>
                      <span className="group-hover:translate-x-0.5 transition-transform">
                        {link.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Contact Information */}
          <div className="lg:col-span-4">
            <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-4">
              Contact Information
            </h4>
            <div className="space-y-4">
              {/* Physical Address */}
              {currentStore.storeType === 'physical' && currentStore.fullAddress && (
                <div className="flex items-start gap-3">
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-900 mb-1">Store Location</p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {currentStore.fullAddress}
                    </p>
                  </div>
                </div>
              )}

              {/* Phone */}
              {currentStore.storePhone && (
                <div className="flex items-start gap-3">
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <Phone className="w-4 h-4" style={{ color: primaryColor }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-900 mb-1">Phone</p>
                    <a 
                      href={`tel:${currentStore.storePhone}`}
                      className="text-sm text-gray-600 hover:underline"
                      style={{ 
                        '--hover-color': primaryColor 
                      }}
                      onMouseEnter={(e) => e.target.style.color = primaryColor}
                      onMouseLeave={(e) => e.target.style.color = ''}
                    >
                      {currentStore.storePhone}
                    </a>
                  </div>
                </div>
              )}

              {/* Email */}
              {currentStore.storeEmail && (
                <div className="flex items-start gap-3">
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <Mail className="w-4 h-4" style={{ color: primaryColor }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-900 mb-1">Email</p>
                    <a 
                      href={`mailto:${currentStore.storeEmail}`}
                      className="text-sm text-gray-600 hover:underline break-all"
                      onMouseEnter={(e) => e.target.style.color = primaryColor}
                      onMouseLeave={(e) => e.target.style.color = ''}
                    >
                      {currentStore.storeEmail}
                    </a>
                  </div>
                </div>
              )}

              {/* Store Hours */}
              <div className="flex items-start gap-3">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${primaryColor}10` }}
                >
                  <Clock className="w-4 h-4" style={{ color: primaryColor }} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900 mb-1">Store Hours</p>
                  <p className="text-sm text-gray-600">
                    {currentStore.storeType === 'physical' 
                      ? 'Mon - Sat: 9:00 AM - 6:00 PM' 
                      : 'Available 24/7 Online'}
                  </p>
                </div>
              </div>

              {/* Delivery Areas Badge */}
              {currentStore.storeType === 'online' && currentStore.onlineStoreInfo?.deliveryAreas?.length > 0 && (
                <div 
                  className="p-3 rounded-lg border"
                  style={{ 
                    backgroundColor: `${primaryColor}05`,
                    borderColor: `${primaryColor}20`
                  }}
                >
                  <p className="text-xs font-semibold text-gray-900 mb-2">We Deliver To:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentStore.onlineStoreInfo.deliveryAreas.slice(0, 4).map((area, index) => (
                      <span 
                        key={index}
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ 
                          backgroundColor: `${primaryColor}15`,
                          color: primaryColor
                        }}
                      >
                        {area}
                      </span>
                    ))}
                    {currentStore.onlineStoreInfo.deliveryAreas.length > 4 && (
                      <span 
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ 
                          backgroundColor: `${primaryColor}15`,
                          color: primaryColor
                        }}
                      >
                        +{currentStore.onlineStoreInfo.deliveryAreas.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div 
        className="border-t"
        style={{ 
          backgroundColor: `${primaryColor}05`,
          borderColor: `${primaryColor}15`
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Copyright & Stora Branding */}
            <div className="text-center sm:text-left">
              <p className="text-sm text-gray-600 font-medium">
                © {new Date().getFullYear()} {currentStore.storeName}. All rights reserved.
              </p>
              <p className="text-xs text-gray-500 mt-1.5 flex items-center justify-center sm:justify-start gap-1">
                <span>Powered by</span>
                <a
                  href="https://stora.com.ng"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gold-700 hover:underline inline-flex items-center gap-1.5 transition-colors"
                >
                  <img src="/favicon-16x16.png" alt="" className="w-3.5 h-3.5 rounded-[3px]" />
                  Stora
                </a>
              </p>
            </div>

            {/* Scroll to Top Button */}
            <button
              onClick={scrollToTop}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:shadow-md hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: primaryColor,
                color: 'white'
              }}
            >
              <ArrowUp className="w-4 h-4" />
              <span>Back to Top</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
