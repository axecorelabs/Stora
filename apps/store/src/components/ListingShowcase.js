import Image from 'next/image';
import ListingGallery from '@/components/ListingGallery';
import BusinessProfileReviews from '@/components/listing/BusinessProfileReviews';
import ListingDescription from '@/components/listing/ListingDescription';
import ViewBeacon from '@/components/analytics/ViewBeacon';
import { findGalleryByStoreId } from '@/lib/supabaseStore';
import { CATEGORY_ICONS, DEFAULT_VENDOR_ICON, getVendorFallbackColor, VENDOR_CARD_PLACEHOLDER_BANNER } from '@/lib/vendorCardPlaceholders';
import { DAYS_OF_WEEK, formatDayHours } from '@stora/shared-constants';
import { ChevronLeft, ExternalLink, Mail, MapPin, MessageCircle, MoreHorizontal, Phone, ShieldCheck, Tag } from 'lucide-react';

// No logo: a category-matched icon in the store's rotated fallback color
// instead of a bare initial letter -- same treatment as the vendor cards
// on /vendors and the products page (vendorCardPlaceholders.js), so an
// unbranded business looks consistent everywhere it appears, not just on
// its own profile page.
function ShowcaseLogo({ branding, storeName, businessCategory, fallbackColor }) {
  if (branding.logo) {
    return (
      <Image
        src={branding.logo}
        alt={storeName}
        fill
        sizes="(min-width: 640px) 8rem, 65px"
        className="object-cover"
        unoptimized
      />
    );
  }

  const CategoryIcon = CATEGORY_ICONS[businessCategory] || DEFAULT_VENDOR_ICON;

  return (
    <div className="grid h-full w-full place-items-center bg-white" style={{ color: fallbackColor }}>
      <CategoryIcon className="h-7 w-7 sm:h-12 sm:w-12" strokeWidth={1.75} />
    </div>
  );
}

function ContactButtons({ store }) {
  const channels = getContactChannels(store);
  const hasPhone = Boolean(channels.phone);
  const hasWhatsapp = Boolean(channels.whatsapp);
  const hasEmail = Boolean(channels.email);

  if (!hasPhone && !hasWhatsapp && !hasEmail) return null;

  const primary = channels.phone
    ? { href: `tel:${channels.phone}`, icon: Phone, label: 'Call' }
    : channels.whatsapp
      ? { href: `https://wa.me/${channels.whatsapp.replace(/\D/g, '')}`, icon: MessageCircle, label: 'WhatsApp', target: '_blank' }
      : null;

  const secondary = channels.email
    ? { href: `mailto:${channels.email}`, icon: Mail, label: 'Email' }
    : channels.phone && channels.whatsapp
      ? { href: `https://wa.me/${channels.whatsapp.replace(/\D/g, '')}`, icon: MessageCircle, label: 'WhatsApp', target: '_blank' }
      : null;

  if (!primary && !secondary) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:max-w-md">
      {primary && (
        <a
          href={primary.href}
          target={primary.target}
          rel={primary.target ? 'noopener noreferrer' : undefined}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-brand-800 px-5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-brand-900 sm:h-12 sm:min-w-36 sm:text-base"
        >
          <primary.icon className="h-4 w-4 fill-white stroke-white sm:h-5 sm:w-5" />
          {primary.label}
        </a>
      )}
      {secondary && (
        <a
          href={secondary.href}
          target={secondary.target}
          rel={secondary.target ? 'noopener noreferrer' : undefined}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#eef2ef] px-5 text-[13px] font-bold text-brand-800 transition-colors hover:bg-brand-50 sm:h-12 sm:min-w-36 sm:text-base"
        >
          <secondary.icon className="h-4 w-4 stroke-[2.4] sm:h-5 sm:w-5" />
          {secondary.label}
        </a>
      )}
    </div>
  );
}

function TopMenu({ store, addressText }) {
  const channels = getContactChannels(store);
  const mapUrl = addressText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
    : null;

  return (
    <details className="group relative">
      <summary
        aria-label="Open listing menu"
        className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full bg-white/90 text-black shadow-sm backdrop-blur transition hover:bg-white sm:h-12 sm:w-12 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="h-4 w-4 stroke-[3] sm:h-6 sm:w-6" />
      </summary>
      <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-2xl bg-white py-2 text-sm font-semibold text-gray-800 shadow-xl ring-1 ring-black/5 sm:top-14">
        {channels.phone && (
          <a href={`tel:${channels.phone}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <Phone className="h-4 w-4 text-brand-800" />
            Call store
          </a>
        )}
        {channels.whatsapp && (
          <a
            href={`https://wa.me/${channels.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <MessageCircle className="h-4 w-4 text-brand-800" />
            WhatsApp
          </a>
        )}
        {channels.email && (
          <a href={`mailto:${channels.email}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <Mail className="h-4 w-4 text-brand-800" />
            Send email
          </a>
        )}
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <MapPin className="h-4 w-4 text-brand-800" />
            Open map
          </a>
        )}
        <a href="https://stora.com.ng/" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
          <ExternalLink className="h-4 w-4 text-brand-800" />
          Stora home
        </a>
      </div>
    </details>
  );
}

function ListingFooter({ store, addressText }) {
  const channels = getContactChannels(store);
  const summary = getTodayHoursSummary(store.businessHours);

  return (
    <footer className="mt-10 border-t border-gray-100 pt-6 pb-20 sm:mt-14 sm:pb-8">
      {summary && (
        <p className="text-sm font-medium text-gray-600">{summary}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {channels.phone && (
          <a href={`tel:${channels.phone}`} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-200 hover:text-brand-800">
            Call
          </a>
        )}
        {channels.whatsapp && (
          <a
            href={`https://wa.me/${channels.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-200 hover:text-brand-800"
          >
            WhatsApp
          </a>
        )}
        {channels.email && (
          <a href={`mailto:${channels.email}`} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-200 hover:text-brand-800">
            Email
          </a>
        )}
        {addressText && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-200 hover:text-brand-800"
          >
            Open map
          </a>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-500">
        <a href="/terms" className="hover:text-brand-800">Terms</a>
        <a href="/privacy" className="hover:text-brand-800">Privacy</a>
        <a href="/delivery-policy" className="hover:text-brand-800">Delivery policy</a>
        <a href="https://stora.com.ng/" className="inline-flex items-center gap-1 hover:text-brand-800">
          Powered by Stora
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </footer>
  );
}

// phone/email are the free tier (visible for any listing, claimed or not).
// whatsapp/social is a premium feature -- only surfaced for an actively
// subscribed listing. See isPubliclyVisibleStore() in supabaseStore.js for
// why the page itself no longer requires a subscription to exist at all.
function getContactChannels(store) {
  const info = store.onlineStoreInfo || {};
  const isPremium = store.subscriptionStatus === 'active';
  return {
    phone: store.storePhone || info.phone || null,
    email: store.storeEmail || info.email || null,
    whatsapp: isPremium ? (info.whatsapp || info?.socialMedia?.whatsapp || null) : null
  };
}

function buildTrustChips(store) {
  const channels = getContactChannels(store);
  const chips = [];

  if (store.businessVerified) {
    chips.push({ key: 'verified', icon: ShieldCheck, label: 'Verified by Stora' });
  }
  if (channels.whatsapp) {
    chips.push({ key: 'whatsapp', icon: MessageCircle, label: 'Responds on WhatsApp' });
  }
  if (store.state) {
    chips.push({ key: 'state', icon: MapPin, label: `In ${store.state}` });
  }

  return chips.slice(0, 3);
}

function normalizePriceList(store) {
  const raw = store.onlineStoreInfo?.priceList;
  if (!raw) return [];

  const source = Array.isArray(raw) ? raw : Array.isArray(raw.items) ? raw.items : [];

  return source
    .map((item) => {
      if (!item) return null;
      const title = typeof item === 'string' ? item : (item.title || item.name || item.label || '').trim();
      if (!title) return null;

      const rawPrice = typeof item === 'object' ? (item.price ?? item.amount ?? item.value ?? item.minPrice) : null;
      const numericPrice = rawPrice === null || rawPrice === undefined || rawPrice === ''
        ? null
        : Number(String(rawPrice).replace(/[^\d.-]/g, ''));

      return {
        title,
        price: Number.isFinite(numericPrice) ? numericPrice : null,
        from: Boolean(item?.from || item?.isFrom || item?.minPrice)
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function formatPriceNgn(value) {
  if (!Number.isFinite(value)) return 'Ask for price';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function getTodayHoursSummary(hours) {
  if (!hours) return null;

  const dayEntry = DAYS_OF_WEEK[new Date().getDay()];
  const todayKey = dayEntry?.key;
  if (!todayKey) return null;

  const formatted = formatDayHours(hours?.[todayKey]);
  if (!formatted) return null;

  return formatted === 'Closed' ? 'Today: Closed' : `Today: Open ${formatted}`;
}

// A real lat/lon (free from OpenStreetMap for seeded listings) drops an
// exact pin -- otherwise Google has to geocode the address TEXT itself,
// which for a bare "Oyo" (state only, no street) centers on the whole
// state rather than the actual spot.
function MapPreviewCard({ addressText, latitude, longitude }) {
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';
  if (!addressText && !hasCoordinates) return null;

  const query = hasCoordinates ? `${latitude},${longitude}` : addressText;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const embedUrl = hasCoordinates
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&t=&z=16&ie=UTF8&iwloc=&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(addressText)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-gray-100">
      <div className="relative h-40 bg-gray-100 sm:h-48">
        <iframe
          title="Business location preview"
          src={embedUrl}
          className="h-full w-full pointer-events-none"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      </div>
      <div className="flex items-center justify-between gap-3 bg-white px-4 py-3">
        <p className="truncate text-sm text-gray-600">Location preview</p>
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50"
        >
          Open in Google Maps
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  );
}

// Precise address/map is free even for an unclaimed or unsubscribed
// listing -- real, findable location is worth more to a business showing
// up on Stora for the first time than it costs Stora to show it, so it's
// the one thing given away as a concrete reason to stick around.
// Everything else premium-gated on this page (reviews, gallery, WhatsApp
// contact) stays gated.
function ShowcaseMapSection({ fullAddress, stateLabel, latitude, longitude }) {
  // A precise pin doesn't need a formatted street address to be worth
  // showing -- many OSM-seeded businesses have real coordinates but never
  // got an addr:street tag. Show the map whenever either is available;
  // the text line above it only prints when there's real address text.
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';

  return (
    <section className="pt-8 sm:pt-10">
      <h2 className="text-sm font-semibold text-gray-900 sm:text-base">Location</h2>

      {fullAddress || hasCoordinates ? (
        <>
          {fullAddress && (
            <div className="mt-3 flex items-center gap-3 text-gray-500">
              <MapPin className="h-4 w-4 shrink-0 stroke-brand-900 stroke-[2.6] sm:h-5 sm:w-5" />
              <p className="min-w-0 text-[13px] font-medium leading-snug sm:text-lg">{fullAddress}</p>
            </div>
          )}
          <MapPreviewCard addressText={fullAddress} latitude={latitude} longitude={longitude} />
        </>
      ) : (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <p className="font-medium text-gray-700">{stateLabel || 'Location'}</p>
          <p className="mt-0.5 text-xs text-gray-500">Location shared on request.</p>
        </div>
      )}
    </section>
  );
}

function PriceListSection({ store }) {
  const list = normalizePriceList(store);
  if (list.length === 0) return null;

  const updatedAt = store.onlineStoreInfo?.priceListUpdatedAt || store.updatedAt;

  return (
    <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Tag className="h-4 w-4 text-brand-800" />
        <h2 className="text-sm font-semibold text-gray-900 sm:text-base">Price list</h2>
      </div>

      <div className="divide-y divide-gray-100">
        {list.map((item, idx) => (
          <div key={`${item.title}-${idx}`} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5">
            <p className="text-sm text-gray-700">{item.title}</p>
            <p className="text-sm font-semibold text-gray-900">
              {item.from ? `From ${formatPriceNgn(item.price)}` : formatPriceNgn(item.price)}
            </p>
          </div>
        ))}
      </div>

      {updatedAt && (
        <p className="mt-3 text-xs text-gray-400">
          Last updated {new Date(updatedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}
        </p>
      )}
    </section>
  );
}

function StickyMobileCta({ store, addressText }) {
  const channels = getContactChannels(store);

  const primary = channels.phone
    ? {
        href: `tel:${channels.phone}`,
        label: 'Call now',
        icon: Phone
      }
    : channels.whatsapp
      ? {
          href: `https://wa.me/${channels.whatsapp.replace(/\D/g, '')}`,
          label: 'Message on WhatsApp',
          icon: MessageCircle,
          target: '_blank'
        }
      : null;

  if (!primary) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-md items-center gap-2">
        <a
          href={primary.href}
          target={primary.target}
          rel={primary.target ? 'noopener noreferrer' : undefined}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-800 px-4 text-sm font-semibold text-white"
        >
          <primary.icon className="h-4 w-4 fill-white stroke-white" />
          {primary.label}
        </a>

        {addressText && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700"
          >
            <MapPin className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

export default async function ListingShowcase({ store }) {
  const gallery = await findGalleryByStoreId(store.id);
  const branding = store.branding || {};
  const address = store.address;
  const isPremium = store.subscriptionStatus === 'active';
  // Precise address is free on this page (even unclaimed/unsubscribed) --
  // computed HERE, once, and threaded through to every place that renders
  // a "get directions" link from it (TopMenu, ListingFooter,
  // StickyMobileCta, ShowcaseMapSection), so they all agree.
  const fullAddress = address
    ? [address.street, address.city, address.state || store.state].filter(Boolean).join(', ')
    : null;
  const stateLabel = store.state || address?.state;
  const heroImage = branding.banner || gallery[0]?.image_url || branding.logo;
  const fallbackColor = getVendorFallbackColor(store.id);
  const trustChips = buildTrustChips(store);

  return (
    <main className="min-h-screen bg-white text-black">
      <ViewBeacon type="store" storeId={store.id} />

      {/* Wrapper keeps the overlay controls in normal flow, outside overflow-hidden */}
      <div className="relative">
        <section className="relative h-[135px] overflow-hidden bg-gray-200 sm:h-[320px] lg:h-[420px]">
          {heroImage ? (
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
              unoptimized
            />
          ) : (
            <>
              <Image
                src={VENDOR_CARD_PLACEHOLDER_BANNER}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
                style={{ opacity: 0.3 }}
                unoptimized
              />
              <div className="absolute inset-0" style={{ backgroundColor: fallbackColor, opacity: 0.55 }} />
            </>
          )}
        </section>

        {/* Controls sit outside overflow-hidden so the dropdown is never clipped */}
        <div className="pointer-events-none absolute inset-x-0 top-4 mx-auto flex w-full max-w-6xl items-center justify-between px-5 sm:top-8 sm:px-8">
          <a
            href="https://stora.com.ng/"
            aria-label="Back to Stora home"
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-white/90 text-black shadow-sm backdrop-blur transition hover:bg-white sm:h-12 sm:w-12"
          >
            <ChevronLeft className="h-4 w-4 stroke-[3] sm:h-6 sm:w-6" />
          </a>
          <div className="pointer-events-auto">
            <TopMenu store={store} addressText={fullAddress} />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pb-14 sm:px-8 lg:px-10">
        <section className="relative">
          <div className="-mt-4 flex items-start gap-4 sm:-mt-14 sm:items-end sm:gap-6">
            <div className="relative grid h-[65px] w-[65px] shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_9px_25px_rgba(15,42,32,0.14)] sm:h-32 sm:w-32 sm:rounded-3xl sm:shadow-[0_12px_30px_rgba(15,42,32,0.16)]">
              <ShowcaseLogo branding={branding} storeName={store.storeName} businessCategory={store.businessCategory} fallbackColor={fallbackColor} />
            </div>
            <div className="min-w-0 pt-6 sm:pb-4 sm:pt-0">
              <h1 className="truncate text-[19px] font-black leading-[1.05] tracking-normal text-black sm:text-5xl sm:leading-tight">
                {store.storeName}
              </h1>
              {stateLabel && (
                <p className="mt-1 text-[12px] font-medium leading-none text-gray-500 sm:text-xl">{stateLabel}</p>
              )}
            </div>
          </div>

          {store.storeDescription && (
            <ListingDescription
              text={store.storeDescription}
              className="text-[13px] font-medium leading-[1.35] text-gray-500 sm:text-xl sm:leading-relaxed"
              maxChars={260}
            />
          )}

          {trustChips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {trustChips.map(({ key, icon: Icon, label }) => (
                <div key={key} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 sm:mt-6">
            <ContactButtons store={store} />
          </div>

        </section>

        <div className="mt-7 border-t border-gray-100 sm:mt-10" />

        <PriceListSection store={store} />

        {isPremium ? (
          gallery.length > 0 ? (
            <ListingGallery items={gallery} />
          ) : (
            <section className="pt-8 sm:pt-10">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center sm:p-8">
                <p className="text-sm font-semibold text-gray-700">No photos yet</p>
                <p className="mt-1 text-xs text-gray-500">This business will add gallery photos soon.</p>
              </div>
            </section>
          )
        ) : (
          <section className="pt-8 sm:pt-10">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center sm:p-8">
              <p className="text-sm font-semibold text-gray-700">Gallery not available yet</p>
              <p className="mt-1 text-xs text-gray-500">Photos are available once this business completes its Stora profile.</p>
            </div>
          </section>
        )}

        <ShowcaseMapSection fullAddress={fullAddress} stateLabel={stateLabel} latitude={store.latitude} longitude={store.longitude} />

        {isPremium && (
          <BusinessProfileReviews
            storeId={store.id}
            initialAverageRating={store.averageRating}
            initialTotalReviews={store.totalReviews}
            mobileFullBleed
          />
        )}

        <ListingFooter store={store} addressText={fullAddress} />
      </div>

      <StickyMobileCta store={store} addressText={fullAddress} />
    </main>
  );
}
