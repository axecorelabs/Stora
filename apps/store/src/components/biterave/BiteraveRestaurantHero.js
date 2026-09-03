"use client";
import { useState } from "react";
import { ShieldCheck, Store, Share2, Check } from "lucide-react";
import StarRating from "@/components/ui/StarRating";

// Own client component (not inlined in the server-component page) purely
// for the share button's interaction -- same web-share/clipboard-fallback
// pattern as ProductDetailsClient.js's own handleShare, just pointed at
// window.location.href (this restaurant's own page) instead of a product
// URL.
export default function BiteraveRestaurantHero({ store }) {
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: store.storeName, text: `Order from ${store.storeName} on Biterave`, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  const deliveryLabel =
    store.deliveryStates && store.deliveryStates.length > 0
      ? `Delivers to ${
          store.deliveryStates.length > 3
            ? `${store.deliveryStates.slice(0, 3).join(", ")} +${store.deliveryStates.length - 3} more`
            : store.deliveryStates.join(", ")
        }`
      : "Delivers nationwide";

  // No banner photo to overlap a card onto -- same flat dark-green panel
  // this page always had, just moved into its own component.
  if (!store.branding?.banner) {
    return (
      <div className="bg-brand-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
            {store.branding?.logo ? (
              <img src={store.branding.logo} alt={store.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-6 h-6 text-white/70" />
            )}
          </div>
          <div className="min-w-0">
            {store.isVerified && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-gold-400/40 mb-2">
                <ShieldCheck className="w-3 h-3 text-gold-400" />
                <span className="text-[10.5px] font-semibold text-gold-400 tracking-wide uppercase">Verified by Stora</span>
              </div>
            )}
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white truncate">{store.storeName}</h1>
            <div className="flex items-center gap-1.5 mt-1">
              {store.totalReviews > 0 && (
                <>
                  <StarRating rating={store.averageRating} size={12} />
                  <span className="text-white/80 text-xs tabular-nums">
                    {store.averageRating.toFixed(1)} · {store.totalReviews} review{store.totalReviews === 1 ? "" : "s"}
                  </span>
                </>
              )}
              <span className="text-white/80 text-xs">
                {store.totalReviews > 0 && <span className="text-white/40 mx-0.5">·</span>}
                {deliveryLabel}
              </span>
            </div>
            {store.storeDescription && <p className="text-white/60 text-sm mt-1.5 line-clamp-2">{store.storeDescription}</p>}
          </div>
        </div>
      </div>
    );
  }

  // With a banner photo: the photo-forward, food-app-style header -- a
  // white info card overlapping the bottom edge of the banner, share
  // button floated on the photo itself.
  return (
    <div>
      <div className="relative h-48 sm:h-64 w-full overflow-hidden bg-brand-800">
        <img src={store.branding.banner} alt="" className="w-full h-full object-cover" />
        <button
          onClick={handleShare}
          className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all"
          aria-label="Share this restaurant"
        >
          {shareSuccess ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4 text-gray-700" />}
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="relative -mt-10 sm:-mt-14 bg-white rounded-3xl shadow-[0_8px_30px_rgba(11,59,46,0.12)] border border-gray-100 p-5 sm:p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-brand-50 flex-shrink-0 flex items-center justify-center">
            {store.branding?.logo ? (
              <img src={store.branding.logo} alt={store.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-6 h-6 text-brand-700" />
            )}
          </div>
          <div className="min-w-0">
            {store.isVerified && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-50 border border-gold-200 mb-2">
                <ShieldCheck className="w-3 h-3 text-gold-600" />
                <span className="text-[10.5px] font-semibold text-gold-700 tracking-wide uppercase">Verified by Stora</span>
              </div>
            )}
            <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-900 truncate">{store.storeName}</h1>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {store.totalReviews > 0 && (
                <>
                  <StarRating rating={store.averageRating} size={12} />
                  <span className="text-gray-500 text-xs tabular-nums">
                    {store.averageRating.toFixed(1)} · {store.totalReviews} review{store.totalReviews === 1 ? "" : "s"}
                  </span>
                </>
              )}
              <span className="text-gray-500 text-xs">
                {store.totalReviews > 0 && <span className="text-gray-300 mx-0.5">·</span>}
                {deliveryLabel}
              </span>
            </div>
            {store.storeDescription && <p className="text-gray-500 text-sm mt-1.5 line-clamp-2">{store.storeDescription}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
