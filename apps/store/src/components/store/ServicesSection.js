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

function ServiceCard({ store, service, primaryColor, secondaryColor }) {
  const image = service.portfolioImages?.[0];
  const whatsappUrl = buildWhatsAppUrl(store, service);

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] transition-all duration-200">
      {/* Same padded-inset image framing as ProductCard.js, so a mixed
          products+services storefront reads as one consistent card
          language rather than two different grids bolted together. */}
      <div className="p-3">
        <div
          className="relative w-full aspect-square rounded-xl overflow-hidden"
          style={{ backgroundColor: secondaryColor || '#F3F4F6' }}
        >
          {image ? (
            <img
              src={image}
              alt={service.name}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Wrench className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
            </div>
          )}
        </div>
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
          {service.duration != null && (
            <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto flex-shrink-0">
              <Clock className="w-3 h-3" />
              {service.duration} {DURATION_UNIT_LABEL[service.durationUnit] || service.durationUnit}
            </span>
          )}
        </div>

        {service.homeServiceAvailable && (
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" /> Home service available
          </p>
        )}

        {whatsappUrl ? (
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
        )}
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
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl md:text-2xl font-semibold text-gray-900">Services</h3>
        <span className="text-sm text-gray-500 tabular-nums">
          {services.length} {services.length === 1 ? 'service' : 'services'}
        </span>
      </div>

      <div
        className={`grid ${
          isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8'
        }`}
      >
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            store={store}
            service={service}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
        ))}
      </div>
    </div>
  );
}
