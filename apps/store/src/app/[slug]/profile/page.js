import { notFound } from 'next/navigation';
import ListingGallery from '@/components/ListingGallery';
import { ExternalLink, MapPin, Phone, Mail } from 'lucide-react';
import { findGalleryByStoreId, findStoreByWebsitePath } from '@/lib/supabaseStore';

export const revalidate = 60;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  try {
    const { slug } = await params;
    const store = await findStoreByWebsitePath(slug);

    if (!store || !store.website?.isEnabled || store.platformMode !== 'store') {
      return {
        title: 'Store Profile Not Found',
        description: 'The store profile you are looking for does not exist.'
      };
    }

    return {
      title: `${store.storeName} Profile | Gallery & Location`,
      description: store.storeDescription || `Gallery and location details for ${store.storeName}.`,
      alternates: {
        canonical: `https://stora.com.ng/${slug}/profile`
      },
      openGraph: {
        title: `${store.storeName} Profile`,
        description: store.storeDescription || `Gallery and location details for ${store.storeName}.`,
        url: `https://stora.com.ng/${slug}/profile`,
        images: [store.branding?.banner || store.branding?.logo || '/og-image.jpg']
      }
    };
  } catch (error) {
    console.error('Error generating profile metadata:', error);
    return {
      title: 'Store Profile',
      description: 'Business profile on Stora.'
    };
  }
}

function buildAddressText(store) {
  const address = store?.address;
  if (!address || typeof address !== 'object') return null;

  const parts = [address.street, address.city, address.state || store.state, address.postalCode]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}

function contactLinks(store) {
  const info = store.onlineStoreInfo || {};
  return {
    phone: store.storePhone || info.phone || null,
    email: store.storeEmail || info.email || null
  };
}

export default async function StoreProfilePage({ params }) {
  const { slug } = await params;
  const store = await findStoreByWebsitePath(slug);

  if (!store || !store.website?.isEnabled || store.platformMode !== 'store') {
    notFound();
  }

  const gallery = await findGalleryByStoreId(store.id);
  const showLocationMap = store?.website?.settings?.locationMap !== false;
  const addressText = buildAddressText(store);
  const mapUrl = showLocationMap && addressText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
    : null;
  const embedUrl = showLocationMap && addressText
    ? `https://maps.google.com/maps?q=${encodeURIComponent(addressText)}&t=&z=14&ie=UTF8&iwloc=&output=embed`
    : null;
  const contacts = contactLinks(store);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-8 sm:py-10">
        <a
          href=".."
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800 hover:text-brand-900"
        >
          Back to storefront <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <header className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-5 sm:p-7">
          <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">{store.storeName}</h1>
          <p className="mt-1 text-sm text-gray-600">Business profile</p>
          {store.storeDescription && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-700 sm:text-base">{store.storeDescription}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {contacts.phone && (
              <a href={`tel:${contacts.phone}`} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-200 hover:text-brand-800">
                <Phone className="h-3.5 w-3.5" />
                Call
              </a>
            )}
            {contacts.email && (
              <a href={`mailto:${contacts.email}`} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-200 hover:text-brand-800">
                <Mail className="h-3.5 w-3.5" />
                Email
              </a>
            )}
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-200 hover:text-brand-800">
                <MapPin className="h-3.5 w-3.5" />
                Open map
              </a>
            )}
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-5 sm:p-7">
          <h2 className="text-base font-semibold text-gray-900">Gallery</h2>
          {gallery.length > 0 ? (
            <div className="mt-4">
              <ListingGallery items={gallery} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No gallery images have been published yet.</p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 sm:p-7">
          <h2 className="text-base font-semibold text-gray-900">Location</h2>
          {addressText && embedUrl ? (
            <>
              <p className="mt-2 text-sm text-gray-600">{addressText}</p>
              <div className="mt-4 h-64 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 sm:h-72">
                <iframe
                  title="Store location"
                  src={embedUrl}
                  className="h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Location details are not available yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}