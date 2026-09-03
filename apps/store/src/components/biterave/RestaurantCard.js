import PrefetchLink from "@/components/ui/PrefetchLink";
import { Store, Star, Clock } from "lucide-react";

// storeSlug-based path, not storeHref() -- see FoodItemCard's comment on
// why plain /biterave/<slug> links are used throughout this section.
//
// avgDeliveryMinutes is computed by the caller (a simple average of this
// store's own items' categoryDetails.food.deliveryTime, converting an
// "hours" unit to minutes first) -- real, already-collected data, not a
// guess, giving restaurant cards the same rating/delivery-time badge feel
// Chowdeck/Glovo cards have.
export default function RestaurantCard({ store, avgDeliveryMinutes }) {
  const rating = Number(store.averageRating || 0);

  return (
    <PrefetchLink
      href={`/biterave/${store.storeSlug}`}
      className="group flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-brand-50 flex-shrink-0 flex items-center justify-center">
        {store.branding?.logo ? (
          <img src={store.branding.logo} alt={store.storeName} className="w-full h-full object-cover" />
        ) : (
          <Store className="w-6 h-6 text-brand-300" />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 truncate group-hover:text-brand-700">{store.storeName}</p>
        {store.storeDescription && (
          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{store.storeDescription}</p>
        )}
        {(rating > 0 || avgDeliveryMinutes) && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            {rating > 0 && (
              <span className="inline-flex items-center gap-0.5 text-gray-600">
                <Star className="w-3.5 h-3.5 text-gold-500 fill-gold-500" /> {rating.toFixed(1)}
              </span>
            )}
            {avgDeliveryMinutes && (
              <span className="inline-flex items-center gap-0.5">
                <Clock className="w-3.5 h-3.5" /> ~{avgDeliveryMinutes} min
              </span>
            )}
          </div>
        )}
      </div>
    </PrefetchLink>
  );
}
