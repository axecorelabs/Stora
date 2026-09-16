import Link from 'next/link';
import { findGalleryByStoreId } from '@/lib/supabaseStore';
import { ChevronLeft, Ellipsis, Grid2X2, Mail, MapPin, Phone, Signal, Wifi } from 'lucide-react';

function PhoneBattery() {
  return (
    <div className="flex items-center gap-1.5 text-black">
      <Signal className="h-4 w-4 stroke-[3]" />
      <Wifi className="h-4 w-4 stroke-[3]" />
      <div className="relative h-[17px] w-7 rounded-[5px] bg-black text-[10px] font-bold leading-[17px] text-white">
        62
        <span className="absolute -right-1 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r-sm bg-black" />
      </div>
    </div>
  );
}

function ShowcaseLogo({ branding, storeName }) {
  if (branding.logo) {
    return (
      <img
        src={branding.logo}
        alt={storeName}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="grid h-full w-full place-items-center text-2xl font-black text-brand-900">
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
    <div className="flex gap-3">
      {phone && (
        <a
          href={`tel:${phone}`}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-brand-800 px-5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-brand-900"
        >
          <Phone className="h-4 w-4 fill-white stroke-white" />
          Call
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-[#eef2ef] px-5 text-[13px] font-bold text-brand-800 transition-colors hover:bg-brand-50"
        >
          <Mail className="h-4 w-4 stroke-[2.4]" />
          Email
        </a>
      )}
    </div>
  );
}

function GalleryGrid({ items }) {
  if (!items?.length) return null;

  return (
    <section className="pt-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[18px] font-bold leading-none tracking-normal text-black">Gallery</h2>
        <div className="flex items-center gap-3 text-gray-500">
          <span className="text-[11px] leading-none">{items.length} photos</span>
          <Grid2X2 className="h-4 w-4 stroke-brand-900 stroke-[2.7]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
        {items.map((item) => (
          <div key={item.id} className="aspect-[1.62] overflow-hidden rounded-md bg-gray-100">
            <img
              src={item.image_url}
              alt={item.caption || 'Gallery image'}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </section>
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
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white">
        <div className="flex h-[38px] items-center justify-between px-[38px]">
          <div className="text-[14px] font-black leading-none tracking-normal text-black">9:41</div>
          <PhoneBattery />
        </div>

        <section className="relative h-[135px] overflow-hidden bg-gray-200">
          {heroImage && (
            <img
              src={heroImage}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-x-0 top-4 flex items-center justify-between px-5">
            <Link
              href="/vendors"
              aria-label="Back to vendors"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-black shadow-sm backdrop-blur"
            >
              <ChevronLeft className="h-4 w-4 stroke-[3]" />
            </Link>
            <button
              type="button"
              aria-label="More options"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-black shadow-sm backdrop-blur"
            >
              <Ellipsis className="h-4 w-4 stroke-[3]" />
            </button>
          </div>
        </section>

        <div className="px-6 pb-10">
          <section className="relative pt-0">
            <div className="-mt-4 flex items-start gap-4">
              <div className="grid h-[65px] w-[65px] shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_9px_25px_rgba(15,42,32,0.14)]">
                <ShowcaseLogo branding={branding} storeName={store.storeName} />
              </div>
              <div className="min-w-0 pt-6">
                <h1 className="truncate text-[19px] font-black leading-[1.05] tracking-normal text-black">
                  {store.storeName}
                </h1>
                {stateLabel && (
                  <p className="mt-1 text-[12px] font-medium leading-none text-gray-500">{stateLabel}</p>
                )}
              </div>
            </div>

            {store.storeDescription && (
              <p className="mt-4 text-[13px] font-medium leading-[1.35] text-gray-500">
                {store.storeDescription}
              </p>
            )}

            <div className="mt-5">
              <ContactButtons store={store} />
            </div>

            {fullAddress && (
              <div className="mt-5 flex items-center gap-3 text-gray-500">
                <MapPin className="h-4 w-4 shrink-0 stroke-brand-900 stroke-[2.6]" />
                <p className="truncate text-[13px] font-medium leading-none">{fullAddress}</p>
              </div>
            )}
          </section>

          <div className="mt-7 border-t border-gray-100" />

          <GalleryGrid items={gallery} />
        </div>

        <div className="sticky bottom-0 flex h-8 items-center justify-center bg-white/95 backdrop-blur">
          <div className="h-1 w-[112px] rounded-full bg-black/85" />
        </div>
      </div>
    </main>
  );
}
