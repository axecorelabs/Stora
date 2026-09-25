"use client";
import { Store, BadgeCheck, LayoutList } from "lucide-react";
import PrefetchLink from "@/components/ui/PrefetchLink";
import { CATEGORY_ICONS, DEFAULT_VENDOR_ICON, getVendorFallbackColor, getVendorPlaceholderBanner } from "@/lib/vendorCardPlaceholders";

// Each vendor's own brand color shows through as a swatch inside Stora's
// frame -- the two-layer brand rule made visible: many identities, one
// accountable structure. Never Stora-brand-colored itself (that would
// misrepresent one specific vendor as if it were platform chrome).
export default function VendorCard({ store }) {
  const primaryColor = store.branding?.primaryColor || getVendorFallbackColor(store.id);
  const CategoryIcon = CATEGORY_ICONS[store.businessCategory] || DEFAULT_VENDOR_ICON;
  const placeholderBanner = getVendorPlaceholderBanner(store.id, store.businessCategory);
  const isListing = store.platformMode === 'listing';
  const profileTag = isListing
    ? { label: 'Business', Icon: LayoutList }
    : { label: 'Store', Icon: Store };

  return (
    <PrefetchLink
      href={`/${store.publicSlug || store.storeSlug}`}
      className="group flex-shrink-0 w-[220px] sm:w-auto bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div
        className="h-20 relative overflow-hidden"
        style={{ backgroundColor: primaryColor }}
      >
        {store.branding?.banner ? (
          <img
            src={store.branding.banner}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.35 }}
          />
        ) : (
          <>
            <img
              src={placeholderBanner.src}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.3, objectPosition: placeholderBanner.position, transform: `scale(${placeholderBanner.scale})` }}
            />
            <div className="absolute inset-0" style={{ backgroundColor: primaryColor, opacity: 0.55 }} />
          </>
        )}
      </div>
      <div className="p-4 -mt-8 relative">
        <div
          className="w-14 h-14 rounded-xl border-4 border-white shadow-sm flex items-center justify-center overflow-hidden bg-white"
          style={{ color: primaryColor }}
        >
          {store.branding?.logo ? (
            <img src={store.branding.logo} alt="" className="w-full h-full object-cover" />
          ) : (
            <CategoryIcon className="w-6 h-6" strokeWidth={1.75} />
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <h3 className="font-semibold text-sm text-gray-900 truncate">{store.storeName}</h3>
          {/* businessVerified (staff-granted "Verified by Stora" badge) --
              not isVerified, the vendor's own identity check. See
              supabaseStore.js's buildPublicStoreData for the split. */}
          {store.businessVerified && (
            <BadgeCheck className="w-3.5 h-3.5 text-gold-600 flex-shrink-0" strokeWidth={2} />
          )}
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
            <profileTag.Icon className="w-2 h-2" />
            {profileTag.label}
          </span>
        </div>
        {store.storeDescription ? (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{store.storeDescription}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Store className="w-3 h-3" /> Visit store
          </p>
        )}
      </div>
    </PrefetchLink>
  );
}
