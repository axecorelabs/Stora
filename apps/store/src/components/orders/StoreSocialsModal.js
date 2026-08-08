"use client";
import { MessageCircle, Package, Phone, Clock, CheckCircle, X, Instagram, Facebook, Twitter, Video, ExternalLink } from "lucide-react";

export default function StoreSocialsModal({ 
  isOpen, 
  onClose, 
  store,
  orderNumber,
  customerName,
  itemCount,
  primaryColor = '#0D9488',
  formatPrice
}) {
  if (!isOpen || !store) return null;

  const getSocialMediaIcon = (platform) => {
    switch (platform) {
      case 'whatsapp':
        return <MessageCircle className="w-5 h-5" />;
      case 'instagram':
        return <Instagram className="w-5 h-5" />;
      case 'facebook':
        return <Facebook className="w-5 h-5" />;
      case 'twitter':
        return <Twitter className="w-5 h-5" />;
      case 'tiktok':
        return <Video className="w-5 h-5" />;
      default:
        return <MessageCircle className="w-5 h-5" />;
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
    
    const cleanHandle = handle.replace('@', '');
    
    switch (platform) {
      case 'whatsapp':
        return handle;
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

  const generateSocialMediaMessage = (platform, storeName) => {
    const baseMessage = `Hi ${storeName}! 👋\n\nI placed an order through your IVMA store:\n📦 Order #${orderNumber}\n👤 Customer: ${customerName}\n📋 Items: ${itemCount}\n\nPlease confirm my order status. Thank you! 😊`;
    
    switch (platform) {
      case 'whatsapp':
        return encodeURIComponent(baseMessage);
      case 'instagram':
      case 'facebook':
      case 'twitter':
      case 'tiktok':
        return encodeURIComponent(`${baseMessage}\n\n#OrderConfirmation #${storeName.replace(/\s+/g, '')}`);
      default:
        return encodeURIComponent(baseMessage);
    }
  };

  const generateSocialMediaUrl = (platform, handle, storeName) => {
    if (!handle || handle.trim() === '') return '';
    
    const cleanHandle = handle.replace('@', '');
    const message = generateSocialMediaMessage(platform, storeName);
    
    switch (platform) {
      case 'whatsapp':
        const cleanPhone = handle.replace(/\s/g, '').replace(/^0/, '234');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;
        return `https://wa.me/${formattedPhone}?text=${message}`;
      case 'instagram':
        return `https://instagram.com/${cleanHandle}`;
      case 'facebook':
        return `https://facebook.com/${cleanHandle}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${message}&via=${cleanHandle}`;
      case 'tiktok':
        return `https://tiktok.com/@${cleanHandle}`;
      default:
        return '';
    }
  };

  const handleSocialMediaClick = (platform, handle, storeName) => {
    const url = generateSocialMediaUrl(platform, handle, storeName);
    if (url) {
      if (platform === 'whatsapp') {
        // For WhatsApp, try to open in new window/tab first
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
          window.location.href = url;
        }
      } else {
        // For other platforms, always open in new tab
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
    onClose();
  };

  const getAvailableSocialMedia = () => {
    const socialMedia = [];
    const socials = store.storeSnapshot?.onlineStoreInfo?.socialMedia || {};
    
    // Add WhatsApp if available
    if (socials.whatsapp && socials.whatsapp.trim() !== '') {
      socialMedia.push({
        platform: 'whatsapp',
        handle: socials.whatsapp,
        displayText: 'WhatsApp',
        description: 'Send direct message with order details'
      });
    }
    
    // Add Instagram if available
    if (socials.instagram && socials.instagram.trim() !== '') {
      socialMedia.push({
        platform: 'instagram',
        handle: socials.instagram,
        displayText: 'Instagram',
        description: 'Visit profile and send DM'
      });
    }
    
    // Add Facebook if available
    if (socials.facebook && socials.facebook.trim() !== '') {
      socialMedia.push({
        platform: 'facebook',
        handle: socials.facebook,
        displayText: 'Facebook',
        description: 'Visit page and send message'
      });
    }
    
    // Add Twitter if available
    if (socials.twitter && socials.twitter.trim() !== '') {
      socialMedia.push({
        platform: 'twitter',
        handle: socials.twitter,
        displayText: 'Twitter',
        description: 'Tweet about your order'
      });
    }
    
    // Add TikTok if available
    if (socials.tiktok && socials.tiktok.trim() !== '') {
      socialMedia.push({
        platform: 'tiktok',
        handle: socials.tiktok,
        displayText: 'TikTok',
        description: 'Visit profile'
      });
    }
    
    // Fallback: Check if store has phone number directly
    if (socialMedia.length === 0 && store.storeSnapshot?.storePhone && store.storeSnapshot.storePhone.trim() !== '') {
      socialMedia.push({
        platform: 'whatsapp',
        handle: store.storeSnapshot.storePhone,
        displayText: 'WhatsApp',
        description: 'Send direct message with order details'
      });
    }
    
    return socialMedia;
  };

  const availableSocials = getAvailableSocialMedia();

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden" style={{ boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)', overflowY: 'auto' }}>
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
            <Package className="w-8 h-8" style={{ color: primaryColor }} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Contact {store.storeName}</h3>
          <p className="text-gray-600 text-sm">
            Reach out via your preferred platform
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Order Summary */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Package className="w-5 h-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{store.storeName}</h4>
                <p className="text-sm text-gray-500">
                  Order #{orderNumber} • {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </p>
                {store.subtotal && (
                  <p className="text-sm font-medium text-gray-700">
                    Total: {formatPrice(store.subtotal)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Available Social Media Platforms */}
          {availableSocials.length > 0 ? (
            <div className="space-y-3 mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Available Contact Methods:</h4>
              {availableSocials.map((social, index) => (
                <button
                  key={index}
                  onClick={() => handleSocialMediaClick(social.platform, social.handle, store.storeName)}
                  className="w-full p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: getSocialMediaColor(social.platform) }}
                      >
                        {getSocialMediaIcon(social.platform)}
                      </div>
                      <div>
                        <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                          {social.displayText}
                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                        </h5>
                        <p className="text-sm text-gray-500">
                          {formatSocialMediaHandle(social.platform, social.handle)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {social.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📱</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No Contact Methods Available</h4>
              <p className="text-sm text-gray-500">
                This store hasn't added their social media contacts yet.
              </p>
            </div>
          )}

          {/* Message Preview */}
          {availableSocials.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">Message Preview:</p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    "Hi {store.storeName}! I placed an order #{orderNumber} with {itemCount} {itemCount === 1 ? 'item' : 'items'}. Please confirm my order status. Thank you!"
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
