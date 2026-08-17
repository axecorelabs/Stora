"use client";
import { MessageCircle, Package, Phone, Clock, CheckCircle, X, Instagram, Facebook, Twitter, Video } from "lucide-react";

export default function WhatsAppContactModal({
  isOpen,
  onClose,
  order,
  contactOnly = true,
  willRedirectToPayment = false,
  formatPrice,
  openWhatsApp
}) {
  if (!isOpen || !order) return null;

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
    const socialMedia = [];

    // Check onlineStoreInfo.socialMedia - safely access nested properties
    const socials = store.storeSnapshot?.onlineStoreInfo?.socialMedia || {};

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
    
    return socialMedia;
  };

  const handleContactFirstAvailable = () => {
    // Find first store with any social media
    const storeWithSocials = order.stores?.find(store => {
      const availableSocials = getAvailableSocialMedia(store);
      return availableSocials.length > 0;
    });
    
    if (storeWithSocials) {
      const availableSocials = getAvailableSocialMedia(storeWithSocials);
      const firstSocial = availableSocials[0];

      handleSocialMediaClick(
        firstSocial.platform,
        firstSocial.handle,
        storeWithSocials.storeName,
        storeWithSocials.itemCount
      );
    }
    // No store with a social contact: the button below is disabled in that
    // case (see hasAnyContact), so this branch is unreachable in practice --
    // no alert() needed as a fallback for a state that can't occur.
  };

  const hasAnyContact = (order.stores || []).some(
    store => getAvailableSocialMedia(store).length > 0
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(8, 42, 32, 0.55)' }}>
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90dvh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header -- this lists contacts across however many vendors
            are in the order, so it's Stora chrome (brand-toned) rather
            than any single vendor's color, which would misrepresent the
            others in the list. */}
        <div className="text-center p-6 border-b border-gray-100 relative flex-shrink-0 bg-brand-50/70">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>

          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-brand-100">
            <MessageCircle className="w-8 h-8 text-brand-700" />
          </div>
          <h3 className="font-display text-xl font-semibold text-brand-900 mb-1.5">
            {contactOnly ? "Contact these sellers to confirm" : "Message your sellers"}
          </h3>
          <p className="text-brand-800/60 text-sm">
            {contactOnly
              ? "Online payment isn't available for them yet"
              : "Reach out about your order"}
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto">
          {(contactOnly || willRedirectToPayment) && (
            <div className="space-y-2 mb-5">
              {contactOnly && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-gold-400/10 border border-gold-500/25">
                  <Clock className="w-4 h-4 text-gold-700 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-brand-900/80">
                    These sellers can&apos;t be paid online yet -- reach out below to arrange payment and confirm your order.
                  </p>
                </div>
              )}
              {willRedirectToPayment && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-brand-50 border border-brand-100">
                  <CheckCircle className="w-4 h-4 text-brand-700 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-brand-900/80">
                    The rest of your order is paid online -- closing this takes you there next.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Store Contact Buttons */}
          <div className="space-y-3 mb-5">
            {order.stores?.map((store, index) => {
              const availableSocials = getAvailableSocialMedia(store);

              return (
                <div key={index} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-50">
                        <Package className="w-5 h-5 text-brand-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="font-semibold text-gray-900 text-sm truncate">
                          {store.storeName}
                        </h5>
                        <p className="text-xs text-gray-500 tabular-nums">
                          {store.itemCount} {store.itemCount === 1 ? 'item' : 'items'} · {formatPrice(store.subtotal)}
                        </p>

                        {availableSocials.length === 0 && (
                          <p className="text-xs text-gray-400 mt-1.5">No contact available</p>
                        )}
                      </div>
                    </div>

                    {/* Social Media Buttons */}
                    {availableSocials.length > 0 && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {availableSocials.slice(0, 3).map((social, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSocialMediaClick(
                                social.platform,
                                social.handle,
                                store.storeName,
                                store.itemCount
                              );
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-white rounded-lg font-medium hover:brightness-95 transition-all text-xs"
                            style={{ backgroundColor: getSocialMediaColor(social.platform) }}
                          >
                            {getSocialMediaIcon(social.platform)}
                            <span className="hidden sm:inline">{social.displayText}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Benefits Info */}
          <div className="bg-brand-50/60 border border-brand-100/70 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-brand-800 uppercase tracking-wide mb-2.5">Why contact vendors directly?</p>
            <ul className="space-y-1.5">
              {[
                'Get instant order confirmation',
                'Receive accurate delivery estimates',
                'Ask questions about your items',
                'Get priority customer service',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              {willRedirectToPayment ? "Continue to payment" : "Maybe later"}
            </button>
            <button
              onClick={handleContactFirstAvailable}
              disabled={!hasAnyContact}
              className="flex-1 py-3 text-white rounded-xl font-semibold text-sm bg-brand-700 hover:bg-brand-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Contact now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
