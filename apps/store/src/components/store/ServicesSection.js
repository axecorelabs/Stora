"use client";
import { Wrench, MapPin, Clock, MessageCircle } from "lucide-react";

const DURATION_UNIT_LABEL = { minutes: 'min', hours: 'hr', days: 'day' };

function formatPrice(price) {
  return `₦${Number(price || 0).toLocaleString()}`;
}

// Same phone-cleaning convention already duplicated in CartPageContent.js,
// OrderDetailsPageContent.js and WhatsAppContactModal.js (all order-flow
// contexts) -- there's no order here, just a pre-purchase service inquiry,
// so this builds its own wa.me link rather than reusing those order-shaped
// components. Dedicated WhatsApp handle takes priority over the store's
// general phone number, same precedence WhatsAppContactModal uses.
function buildWhatsAppUrl(store, service) {
  const handle = store.onlineStoreInfo?.socialMedia?.whatsapp || store.storePhone;
  if (!handle) return null;

  const cleanPhone = handle.replace(/\s/g, '').replace(/^0/, '234');
  const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;
  const message = encodeURIComponent(
    `Hi ${store.storeName}! I'd like to book "${service.name}" (${formatPrice(service.price)}) -- is it available?`
  );
  return `https://wa.me/${formattedPhone}?text=${message}`;
}

// The book-a-service button/no-contact-fallback -- identical markup for
// both card layouts below, just at a different width/spot in each.
function BookButton({ whatsappUrl, primaryColor }) {
  return whatsappUrl ? (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 text-white transition-all hover:brightness-95"
      style={{ backgroundColor: primaryColor }}
    >
      <MessageCircle className="w-3.5 h-3.5" />
      Contact to book
    </a>
  ) : (
    <div className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 bg-gray-100 text-gray-400 cursor-not-allowed">
      No contact available
    </div>
  );
}

function ServiceThumbnail({ image, name, secondaryColor, className }) {
  return (
    <div
      className={`relative flex-shrink-0 rounded-xl overflow-hidden ${className}`}
      style={{ backgroundColor: secondaryColor || '#F3F4F6' }}
    >
      {image ? (
        <img
          src={image}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Wrench className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

// A service card carries meaningfully more to read than a product tile --
// name, category, a description, price *and* duration, sometimes a
// home-service note -- on top of the one photo. The square, grid-of-two
// layout ProductCard.js uses works because a product is mostly the photo;
// forcing a service into that same narrow half-width column crammed all of
// that text into a couple of tight lines, and left an awkward half-empty
// row any time a store had an odd number of services (most have just one
// or two). Mobile gets its own full-width, single-column row layout
// instead -- a compact thumbnail beside the text, sized like a listing you
// scan down a list, not a tile you scan across a grid. Desktop keeps the
// original grid/card -- it already has the horizontal room the square
// layout needs, and a multi-column grid of services still reads fine there.
function ServiceCard({ store, service, primaryColor, secondaryColor, isMobile }) {
  const image = service.portfolioImages?.[0];
  const whatsappUrl = buildWhatsAppUrl(store, service);
  const durationLabel = service.duration != null
    ? `${service.duration} ${DURATION_UNIT_LABEL[service.durationUnit] || service.durationUnit}`
    : null;

  if (isMobile) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-3">
        <div className="flex gap-3">
          <ServiceThumbnail image={image} name={service.name} secondaryColor={secondaryColor} className="w-20 h-20" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">{service.category}</p>
            <h3 className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-1">{service.name}</h3>
            {service.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{service.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-base font-bold tabular-nums" style={{ color: primaryColor }}>
                {formatPrice(service.price)}
              </span>
              {durationLabel && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {durationLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {service.homeServiceAvailable && (
          <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" /> Home service available
          </p>
        )}

        <div className="mt-3">
          <BookButton whatsappUrl={whatsappUrl} primaryColor={primaryColor} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] transition-all duration-200">
      {/* Same padded-inset image framing as ProductCard.js, so a mixed
          products+services storefront reads as one consistent card
          language rather than two different grids bolted together. */}
      <div className="p-3">
        <ServiceThumbnail image={image} name={service.name} secondaryColor={secondaryColor} className="w-full aspect-square" />
      </div>

      <div className="px-3.5 pb-3.5">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{service.category}</p>
        <h3 className="text-[14px] font-semibold text-gray-900 mb-1.5 line-clamp-1">{service.name}</h3>
        {service.description && (
          <p className="text-xs text-gray-500 mb-2 line-clamp-2">{service.description}</p>
        )}

        <div className="flex items-center gap-2 mb-3">
          <span className="text-base font-bold tabular-nums" style={{ color: primaryColor }}>
            {formatPrice(service.price)}
          </span>
          {durationLabel && (
            <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto flex-shrink-0">
              <Clock className="w-3 h-3" />
              {durationLabel}
            </span>
          )}
        </div>

        {service.homeServiceAvailable && (
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" /> Home service available
          </p>
        )}

        <BookButton whatsappUrl={whatsappUrl} primaryColor={primaryColor} />
      </div>
    </div>
  );
}

// Lighter than the product/e-commerce path by design -- no cart, no
// checkout, no online payment. A service card's one action is "Contact to
// book," which just opens WhatsApp with the service pre-filled into the
// message; the vendor and shopper take it from there.
export default function ServicesSection({ store, isMobile }) {
  const services = store.services || [];
  if (services.length === 0) return null;

  const primaryColor = store.branding?.primaryColor || "#0D9488";
  const secondaryColor = store.branding?.secondaryColor || "#F3F4F6";

  return (
    // mt-12 -- the products section above ends with its own "See all
    // products" button wrapped in mt-12 (space above the button, from the
    // grid), but nothing gave space below it before this section's own
    // heading started -- the two sat flush against each other. Only used
    // in this one spot (right after products in StoreWebsite.js), so this
    // is safe to own outright rather than needing a wrapper margin at the
    // call site.
    <div className="mt-12 mb-12">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl md:text-2xl font-semibold text-gray-900">Services</h3>
        <span className="text-sm text-gray-500 tabular-nums">
          {services.length} {services.length === 1 ? 'service' : 'services'}
        </span>
      </div>

      <div
        className={isMobile ? 'flex flex-col gap-3' : 'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8'}
      >
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            store={store}
            service={service}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            isMobile={isMobile}
          />
        ))}
      </div>
    </div>
  );
}
