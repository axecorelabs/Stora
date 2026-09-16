import Image from 'next/image';
import ListingGallery from '@/components/ListingGallery';
import { findGalleryByStoreId } from '@/lib/supabaseStore';
import { ChevronLeft, ExternalLink, Mail, MapPin, MoreHorizontal, Phone } from 'lucide-react';

function ShowcaseLogo({ branding, storeName }) {
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

  return (
    <div className="grid h-full w-full place-items-center bg-white text-2xl font-black text-brand-900 sm:text-4xl">
      {storeName?.charAt(0)?.toUpperCase() || 'S'}
    </div>
  );
}

function ContactButtons({ store }) {
  const info = store.onlineStoreInfo || {};
  const phone = store.storePhone || info.phone;
  const email = store.storeEmail || info.email;

  if (!phone && !email) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:max-w-md">
      {phone && (
        <a
          href={`tel:${phone}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-brand-800 px-5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-brand-900 sm:h-12 sm:min-w-36 sm:text-base"
        >
          <Phone className="h-4 w-4 fill-white stroke-white sm:h-5 sm:w-5" />
          Call
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#eef2ef] px-5 text-[13px] font-bold text-brand-800 transition-colors hover:bg-brand-50 sm:h-12 sm:min-w-36 sm:text-base"
        >
          <Mail className="h-4 w-4 stroke-[2.4] sm:h-5 sm:w-5" />
          Email
        </a>
      )}
    </div>
  );
}

function TopMenu({ store, addressText }) {
  const info = store.onlineStoreInfo || {};
  const phone = store.storePhone || info.phone;
  const email = store.storeEmail || info.email;
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
        {phone && (
          <a href={`tel:${phone}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <Phone className="h-4 w-4 text-brand-800" />
            Call store
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
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

function ListingFooter({ storeName }) {
  return (
    <footer className="mt-12 border-t border-gray-100 py-7 sm:mt-16">
      <div className="flex flex-col gap-2 text-[11px] font-medium text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <p>{storeName} on Stora</p>
        <a href="https://stora.com.ng/" className="inline-flex w-fit items-center gap-1 text-gray-500 transition hover:text-brand-800">
          Visit stora.com.ng
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </footer>
  );
}

export default async function ListingShowcase({ store }) {
  const gallery = await findGalleryByStoreId(store.id);
  const branding = store.branding || {};
  const address = store.address;
  const fullAddress = address
    ? [address.street, address.city, address.state || store.state].filter(Boolean).join(', ')
    : null;
  const stateLabel = store.state || address?.state;
  const heroImage = branding.banner || gallery[0]?.image_url || branding.logo;

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Wrapper keeps the overlay controls in normal flow, outside overflow-hidden */}
      <div className="relative">
        <section className="relative h-[135px] overflow-hidden bg-gray-200 sm:h-[320px] lg:h-[420px]">
          {heroImage && (
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
              unoptimized
            />
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
              <ShowcaseLogo branding={branding} storeName={store.storeName} />
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
            <p className="mt-4 max-w-3xl text-[13px] font-medium leading-[1.35] text-gray-500 sm:mt-6 sm:text-xl sm:leading-relaxed">
              {store.storeDescription}
            </p>
          )}

          <div className="mt-5 sm:mt-6">
            <ContactButtons store={store} />
          </div>

          {fullAddress && (
            <div className="mt-5 flex items-center gap-3 text-gray-500 sm:mt-7">
              <MapPin className="h-4 w-4 shrink-0 stroke-brand-900 stroke-[2.6] sm:h-5 sm:w-5" />
              <p className="min-w-0 text-[13px] font-medium leading-snug sm:text-lg">{fullAddress}</p>
            </div>
          )}
        </section>

        <div className="mt-7 border-t border-gray-100 sm:mt-10" />

        <ListingGallery items={gallery} />
        <ListingFooter storeName={store.storeName} />
      </div>
    </main>
  );
}
