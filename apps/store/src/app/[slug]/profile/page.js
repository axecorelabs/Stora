import { notFound } from 'next/navigation';
import StoreProfileClient from '@/components/StoreProfileClient';
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
        images: [store.branding?.banner || store.branding?.logo || '/stora2.png']
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
    <StoreProfileClient
      store={store}
      gallery={gallery}
      addressText={addressText}
      mapUrl={mapUrl}
      embedUrl={embedUrl}
      contacts={contacts}
    />
  );
}