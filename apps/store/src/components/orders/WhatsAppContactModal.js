"use client";
import { MessageCircle, Package, Phone, Clock, CheckCircle, X, Instagram, Facebook, Twitter, Video } from "lucide-react";

export default function WhatsAppContactModal({ 
  isOpen, 
  onClose, 
  order, 
  primaryColor = '#0D9488',
  formatPrice,
  openWhatsApp 
}) {
  console.log('WhatsAppContactModal render:', { isOpen, hasOrder: !!order, storesCount: order?.stores?.length });
  
  if (!isOpen || !order) return null;

  console.log('Modal is open! Order stores:', order.stores);

  const getSocialMediaIcon = (platform) => {
    switch (platform) {
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4" />;
      case 'instagram':
        return <Instagram className="w-4 h-4" />;
      case 'facebook':
        return <Facebook className="w-4 h-4" />;
      case 'twitter':
        return <Twitter className="w-4 h-4" />;
      case 'tiktok':
        return <Video className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getSocialMediaColor = (platform) => {
    switch (platform) {
      case 'whatsapp':
        return '#25D366';
      case 'instagram':
        return '#E4405F';
      case 'facebook':
        return '#1877F2';
      case 'twitter':
        return '#1DA1F2';
      case 'tiktok':
        return '#000000';
      default:
        return '#25D366';
    }
  };

  const formatSocialMediaHandle = (platform, handle) => {
    if (!handle || handle.trim() === '') return '';
    
    // Remove @ symbol if present for cleaner display
    const cleanHandle = handle.replace('@', '');
    
    switch (platform) {
      case 'whatsapp':
        return handle; // Keep phone number as is
      case 'instagram':
        return `@${cleanHandle}`;
      case 'facebook':
        return cleanHandle;
      case 'twitter':
        return `@${cleanHandle}`;
      case 'tiktok':
        return `@${cleanHandle}`;
      default:
        return handle;
    }
  };

  const generateSocialMediaUrl = (platform, handle) => {
    if (!handle || handle.trim() === '') return '';
    
    const cleanHandle = handle.replace('@', '');
    
    switch (platform) {
      case 'whatsapp':
        // Format WhatsApp number
        const cleanPhone = handle.replace(/\s/g, '').replace(/^0/, '234');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;
        return `https://wa.me/${formattedPhone}`;
      case 'instagram':
        return `https://instagram.com/${cleanHandle}`;
      case 'facebook':
        return `https://facebook.com/${cleanHandle}`;
      case 'twitter':
        return `https://twitter.com/${cleanHandle}`;
      case 'tiktok':
        return `https://tiktok.com/@${cleanHandle}`;
      default:
        return '';
    }
  };

  const handleSocialMediaClick = (platform, handle, storeName, itemCount) => {
    if (platform === 'whatsapp') {
      // Use existing WhatsApp function with order details
      openWhatsApp(handle, storeName, itemCount);
    } else {
      // Open other social media platforms in new tab
      const url = generateSocialMediaUrl(platform, handle);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
    onClose();
  };

  const getAvailableSocialMedia = (store) => {
    console.log('Getting socials for store:', store);
    console.log('Store snapshot:', store.storeSnapshot);
    console.log('Online store info:', store.storeSnapshot?.onlineStoreInfo);
    
    const socialMedia = [];
    
    // Check onlineStoreInfo.socialMedia - safely access nested properties
    const socials = store.storeSnapshot?.onlineStoreInfo?.socialMedia || {};
    
    console.log('Extracted socials:', socials);
    
    // Add WhatsApp if available (check both nested and direct fields)
    const whatsappHandle = socials.whatsapp || store.storeSnapshot?.whatsapp || store.storePhone;
    if (whatsappHandle && whatsappHandle.trim() !== '') {
      socialMedia.push({
        platform: 'whatsapp',
        handle: whatsappHandle,
        displayText: 'WhatsApp'
      });
    }
    
    // Add Instagram if available (check both nested and direct fields)
    const instagramHandle = socials.instagram || store.storeSnapshot?.instagram;
    if (instagramHandle && instagramHandle.trim() !== '') {
      socialMedia.push({
        platform: 'instagram',
        handle: instagramHandle,
        displayText: 'Instagram'
      });
    }
    
    // Add Facebook if available (check both nested and direct fields)
    const facebookHandle = socials.facebook || store.storeSnapshot?.facebook;
    if (facebookHandle && facebookHandle.trim() !== '') {
      socialMedia.push({
        platform: 'facebook',
        handle: facebookHandle,
        displayText: 'Facebook'
      });
    }
    
    // Add Twitter if available (check both nested and direct fields)
    const twitterHandle = socials.twitter || store.storeSnapshot?.twitter;
    if (twitterHandle && twitterHandle.trim() !== '') {
      socialMedia.push({
        platform: 'twitter',
        handle: twitterHandle,
        displayText: 'Twitter'
      });
    }
    
    // Add TikTok if available (check both nested and direct fields)
    const tiktokHandle = socials.tiktok || store.storeSnapshot?.tiktok;
    if (tiktokHandle && tiktokHandle.trim() !== '') {
      socialMedia.push({
        platform: 'tiktok',
        handle: tiktokHandle,
        displayText: 'TikTok'
      });
    }
    
    console.log('Final social media array:', socialMedia);
    
    return socialMedia;
  };

  const handleContactFirstAvailable = () => {
    console.log('Contact first available clicked');
    
    // Find first store with any social media
    const storeWithSocials = order.stores?.find(store => {
      const availableSocials = getAvailableSocialMedia(store);
      return availableSocials.length > 0;
    });
    
    if (storeWithSocials) {
      const availableSocials = getAvailableSocialMedia(storeWithSocials);
      const firstSocial = availableSocials[0];
      
      console.log('Found store with socials:', storeWithSocials.storeName, firstSocial);
      handleSocialMediaClick(
        firstSocial.platform,
        firstSocial.handle,
        storeWithSocials.storeName,
        storeWithSocials.itemCount
      );
    } else {
      console.log('No stores with social media found');
      alert('No stores have social media contacts available.');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-hidden" style={{ boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)', maxWidth: '28rem' }}>
        {/* Modal Header */}
        <div 
          className="text-center p-6 border-b border-gray-100 relative"
          style={{ backgroundColor: `${primaryColor}10` }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
          
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <MessageCircle className="w-8 h-8" style={{ color: primaryColor }} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Speed Up Your Order! 🚀</h3>
          <p className="text-gray-600">
            Contact vendors directly for faster order confirmation
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <h4 className="text-lg font-semibold text-gray-900">Quick Order Confirmation</h4>
            </div>
            <p className="text-gray-600 text-sm">
              Your order is currently <span className="font-semibold text-yellow-600">pending</span>. 
              Contact the vendors below to get faster confirmation and delivery updates:
            </p>
          </div>

          {/* Store Contact Buttons */}
          <div className="space-y-4 mb-6">
            {order.stores?.map((store, index) => {
              const availableSocials = getAvailableSocialMedia(store);
              
              return (
                <div key={index} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${primaryColor}20` }}
                      >
                        <Package className="w-6 h-6" style={{ color: primaryColor }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="font-semibold text-gray-900">
                          {store.storeName}
                        </h5>
                        <p className="text-sm text-gray-500">
                          {store.itemCount} {store.itemCount === 1 ? 'item' : 'items'} • {formatPrice(store.subtotal)}
                        </p>
                        
                        {/* Display available social media handles */}
                        {availableSocials.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {availableSocials.slice(0, 2).map((social, idx) => (
                              <div key={idx} className="flex items-center gap-1 text-xs text-gray-400">
                                {getSocialMediaIcon(social.platform)}
                                <span>{formatSocialMediaHandle(social.platform, social.handle)}</span>
                              </div>
                            ))}
                            {availableSocials.length > 2 && (
                              <span className="text-xs text-gray-400">+{availableSocials.length - 2} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Social Media Buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0 ml-3">
                      {availableSocials.length > 0 ? (
                        availableSocials.slice(0, 4).map((social, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log(`${social.displayText} button clicked for:`, store.storeName);
                              handleSocialMediaClick(
                                social.platform,
                                social.handle,
                                store.storeName,
                                store.itemCount
                              );
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
                            style={{ backgroundColor: getSocialMediaColor(social.platform) }}
                          >
                            {getSocialMediaIcon(social.platform)}
                            <span className="hidden sm:inline">{social.displayText}</span>
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 py-2">
                          No contacts available
                        </div>
                      )}
                      
                      {/* Show "More" button if there are more than 4 social media accounts */}
                      {availableSocials.length > 4 && (
                        <button
                          className="text-xs text-gray-500 hover:text-gray-700 py-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('More socials for store:', store.storeName);
                          }}
                        >
                          +{availableSocials.length - 4} more
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Benefits Info */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Why contact vendors directly?</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Get instant order confirmation</li>
                  <li>• Receive accurate delivery estimates</li>
                  <li>• Ask questions about your items</li>
                  <li>• Get priority customer service</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Contact Now button clicked');
                handleContactFirstAvailable();
              }}
              className="flex-1 py-3 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#25D366' }}
            >
              Contact Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
