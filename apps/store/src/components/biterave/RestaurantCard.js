import PrefetchLink from "@/components/ui/PrefetchLink";
import { Store, Star, Clock } from "lucide-react";

// storeSlug-based path, not storeHref() -- see FoodItemCard's comment on
// why plain /biterave/<slug> links are used throughout this section.
//
// avgDeliveryMinutes is computed by the caller (a simple average of this
// store's own items' categoryDetails.food.deliveryTime, converting an
// "hours" unit to minutes first) -- real, already-collected data, not a
// guess.
//
// Leads with the store's own banner image, Chowdeck/Glovo-style, rather
// than a small logo in a list row -- a vendor's storefront banner is
// already uploaded and already used this way on the restaurant detail
// page (biterave/[storeSlug]/page.js). Logo sits inline next to the name
// below the banner, not overlapping it.
//
// flex-shrink-0 w-[190px] sm:w-auto -- fixed, compact width in a
// horizontal-scroll row (see biterave/page.js's teaser sections, same
// scroll-on-mobile/grid-on-desktop container components/home/
// VendorShowcase.js uses), auto width once placed in an actual grid
// (the dedicated /biterave/restaurants, /biterave/groceries/vendors pages).
export default function RestaurantCard({ store, avgDeliveryMinutes }) {
  const rating = Number(store.averageRating || 0);

  return (
    <PrefetchLink
      href={`/biterave/${store.storeSlug}`}
      className="group flex-shrink-0 w-[190px] sm:w-auto block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative aspect-[16/10] bg-gradient-to-br from-brand-800 to-brand-900">
        {store.branding?.banner ? (
          <img
            src={store.branding.banner}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store className="w-6 h-6 text-white/30" />
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md overflow-hidden bg-brand-50 flex-shrink-0 flex items-center justify-center">
            {store.branding?.logo ? (
              <img src={store.branding.logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <Store className="w-3 h-3 text-brand-300" />
            )}
          </div>
          <p className="font-semibold text-sm text-gray-900 truncate group-hover:text-brand-700">{store.storeName}</p>
        </div>
        {store.storeDescription && (
          <p className="text-xs text-gray-500 line-clamp-1 mt-1">{store.storeDescription}</p>
        )}

        {(rating > 0 || avgDeliveryMinutes) && (
          <div className="flex items-center gap-2.5 mt-1.5 pt-1.5 border-t border-gray-50 text-[11px] text-gray-500">
            {rating > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                <Star className="w-3 h-3 text-gold-500 fill-gold-500" /> {rating.toFixed(1)}
              </span>
            )}
            {avgDeliveryMinutes && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> ~{avgDeliveryMinutes} min
              </span>
            )}
          </div>
        )}
      </div>
    </PrefetchLink>
  );
}
