import { supabaseAdmin } from '@/lib/supabase';
import { DAYS_OF_WEEK, formatDayHours, hasConfiguredBusinessHours } from '@stora/shared-constants';
import { Phone, Mail, MessageCircle, MapPin, Clock, BadgeCheck } from 'lucide-react';

// Server Component -- fetches gallery directly from Supabase, no API round trip.
async function fetchGallery(storeId) {
  const { data } = await supabaseAdmin
    .from('gallery_items')
    .select('id, image_url, caption, sort_order')
    .eq('store_id', storeId)
    .order('sort_order', { ascending: true });
  return data || [];
}

function ContactButtons({ store }) {
  const info = store.onlineStoreInfo || {};
  const phone = store.storePhone || info.phone;
  const email = store.storeEmail || info.email;
  const whatsapp = info.whatsapp;

  const buttons = [
    phone && {
      label: 'Call',
      href: `tel:${phone}`,
      icon: Phone,
      color: 'bg-brand-800 text-white hover:bg-brand-900'
    },
    whatsapp && {
      label: 'WhatsApp',
      href: `https://wa.me/${whatsapp.replace(/\D/g, '')}`,
      icon: MessageCircle,
      color: 'bg-green-600 text-white hover:bg-green-700',
      target: '_blank'
    },
    email && {
      label: 'Email',
      href: `mailto:${email}`,
      icon: Mail,
      color: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
    }
  ].filter(Boolean);

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {buttons.map(({ label, href, icon: Icon, color, target }) => (
        <a
          key={label}
          href={href}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${color}`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </a>
      ))}
    </div>
  );
}

function BusinessHours({ hours }) {
  if (!hasConfiguredBusinessHours(hours)) return null;

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        Opening hours
      </h2>
      <div className="space-y-1.5">
        {DAYS_OF_WEEK.map(({ key, label }) => {
          const formatted = formatDayHours(hours?.[key]);
          if (!formatted) return null;
          return (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-gray-600 w-28">{label}</span>
              <span className={formatted === 'Closed' ? 'text-gray-400' : 'text-gray-900'}>{formatted}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GalleryGrid({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-3">Gallery</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl overflow-hidden bg-gray-100 aspect-video">
            <img
              src={item.image_url}
              alt={item.caption || 'Gallery image'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {item.caption && (
              <p className="text-xs text-gray-500 px-2 py-1 truncate">{item.caption}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function ListingShowcase({ store }) {
  const gallery = await fetchGallery(store.id);
  const branding = store.branding || {};
  const address = store.address;
  const fullAddress = address
    ? [address.street, address.city, address.state, address.postalCode].filter(Boolean).join(', ')
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero banner */}
      {branding.banner && (
        <div className="w-full h-40 sm:h-56 bg-gray-200 overflow-hidden">
          <img src={branding.banner} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pb-16">
        {/* Logo + name */}
        <div className={`flex items-end gap-4 ${branding.banner ? '-mt-10' : 'mt-8'}`}>
          {branding.logo && (
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border-4 border-white shadow-md flex-shrink-0">
              <img src={branding.logo} alt={store.storeName} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="pb-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold text-gray-900">{store.storeName}</h1>
              {store.businessVerified && (
                <BadgeCheck className="w-5 h-5 text-brand-800 flex-shrink-0" title="Verified by Stora" />
              )}
            </div>
            {store.state && <p className="text-sm text-gray-500 mt-0.5">{store.state}</p>}
          </div>
        </div>

        <div className="mt-6 space-y-8">
          {/* Description */}
          {store.storeDescription && (
            <p className="text-sm text-gray-700 leading-relaxed">{store.storeDescription}</p>
          )}

          {/* Contact */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Get in touch</h2>
            <ContactButtons store={store} />
          </section>

          {/* Address */}
          {fullAddress && (
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                Location
              </h2>
              <p className="text-sm text-gray-700">{fullAddress}</p>
            </section>
          )}

          {/* Business Hours */}
          <BusinessHours hours={store.businessHours} />

          {/* Gallery */}
          <GalleryGrid items={gallery} />
        </div>
      </div>

      {/* Footer attribution */}
      <div className="text-center pb-8">
        <a href="https://stora.com.ng" className="text-xs text-gray-400 hover:text-gray-600">
          Listed on Stora
        </a>
      </div>
    </div>
  );
}
