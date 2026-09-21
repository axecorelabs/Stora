"use client";
import { useState } from "react";
import { BadgeCheck, MapPin, MessageCircle, ArrowRight, LayoutList, Store as StoreIcon } from "lucide-react";
import PrefetchLink from "@/components/ui/PrefetchLink";

// Distinct from home/VendorCard.js -- that one is sized for a dense,
// horizontal-scroll teaser (5+ per row); this one is built for the
// /vendors directory's 2-per-row grid, where there's real room to make
// the case for a vendor, not just name-drop them. Same two-layer brand
// rule though: the vendor's own color shows through as a swatch inside
// Stora's card frame, never as Stora's own chrome.
export default function VendorSearchCard({ store }) {
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoErrored, setLogoErrored] = useState(false);
  const primaryColor = store.branding?.primaryColor || "#145C41";
  const initial = (store.storeName || "?").trim().charAt(0).toUpperCase();
  const location = [store.address?.city, store.state || store.address?.state].filter(Boolean).join(", ");
  const hasWhatsapp = !!store.onlineStoreInfo?.socialMedia?.whatsapp;
  const showLogoImage = store.branding?.logo && !logoErrored;
  const isListing = store.platformMode === 'listing';
  const profileTag = isListing
    ? { label: "Business", Icon: LayoutList }
    : { label: "Store", Icon: StoreIcon };

  return (
    <PrefetchLink
      href={`/${store.publicSlug || store.storeSlug}`}
      className="group flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_8px_24px_rgba(11,59,46,0.10)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="h-28 sm:h-36 relative" style={{ backgroundColor: primaryColor }}>
        {store.branding?.banner && (
          <>
            <img
              src={store.branding.banner}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.35 }}
            />
            {/* Vendor-uploaded banners range from clean photography to a
                cropped WhatsApp promo flyer -- this scrim gives every one
                of them the same darkened-bottom-edge treatment, so the
                grid reads as one consistent design regardless of what a
                given vendor uploaded. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0" />
          </>
        )}
      </div>

      <div className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-9 relative flex-1 flex flex-col">
        <div
          className="w-[72px] h-[72px] rounded-2xl border-4 border-white shadow-sm flex items-center justify-center overflow-hidden bg-white flex-shrink-0 relative"
          style={{ color: primaryColor }}
        >
          {showLogoImage ? (
            <>
              {!logoLoaded && <div className="absolute inset-0 bg-gray-100 animate-pulse" />}
              <img
                src={store.branding.logo}
                alt=""
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  logoLoaded ? "opacity-100" : "opacity-0"
                }`}
                onLoad={() => setLogoLoaded(true)}
                onError={() => setLogoErrored(true)}
              />
            </>
          ) : (
            <span className="font-display text-2xl font-bold">{initial}</span>
          )}
        </div>

        <div className="mt-3.5 flex items-center gap-1.5 min-w-0">
          <h3 className="font-display text-lg font-bold text-gray-900 truncate">{store.storeName}</h3>
          {/* businessVerified (staff-granted "Verified by Stora" badge) --
              not isVerified, the vendor's own identity check. See
              supabaseStore.js's buildPublicStoreData for the split. */}
          {store.businessVerified && (
            <BadgeCheck className="w-4 h-4 text-gold-600 flex-shrink-0" strokeWidth={2} />
          )}
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
            <profileTag.Icon className="w-2.5 h-2.5" /> {profileTag.label}
          </span>
        </div>

        {location && (
          <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {location}
          </p>
        )}

        <p className="text-sm text-gray-600 mt-3 line-clamp-3 flex-1">
          {store.storeDescription || "A vendor on Stora."}
        </p>

        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {hasWhatsapp && !isListing ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 min-w-0">
              <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Reachable on WhatsApp</span>
            </span>
          ) : (
            <span />
          )}
          <span
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-white rounded-full pl-3 pr-2.5 py-1.5 flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {isListing ? 'Contact' : 'Visit store'}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </PrefetchLink>
  );
}
