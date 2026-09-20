import { notFound } from 'next/navigation';
import StoreWebsite from "@/components/StoreWebsite";
import ListingShowcase from "@/components/ListingShowcase";
import { findGalleryByStoreId, findStoreByWebsitePath } from '@/lib/supabaseStore';

// Subscription status can flip listing visibility at any time (paid, past_due,
// cancelled). Use per-request rendering so public access reflects that
// immediately instead of waiting on ISR cache windows.
export const revalidate = 0;

// No slug list is known at build time.
export async function generateStaticParams() {
  return [];
}

// Generate metadata for SEO and social sharing
export async function generateMetadata({ params }) {
  try {
    const { slug } = await params;
    
    // Fetch store by website path using Supabase
    const store = await findStoreByWebsitePath(slug);

    if (!store || !store.website?.isEnabled) {
      return {
        title: 'Store Not Found',
        description: 'The store you are looking for does not exist.'
      };
    }

    const seoSettings = store.website?.seo_settings || {};
    // Always the vendor's resolved public slug (their own chosen address
    // when set, store_slug otherwise -- see publicSlug in supabaseStore.js),
    // never whichever of the store's several equivalent URLs this request
    // happened to arrive on -- otherwise the same page declares a
    // different canonical depending on how it was reached, and matches
    // sitemap.js's own already-established precedent (path form, not the
    // vendor subdomain -- that stays a valid alternate address, just not
    // what Stora's own canonical/sitemap declare as authoritative).
    const canonicalUrl = `https://stora.com.ng/${store.publicSlug || slug}`;
    // Service-only listing businesses don't "sell products" -- this
    // fallback used to say so unconditionally, contradicting the
    // LocalBusiness/Store schema.org split a few lines below, which
    // already gets this right.
    const isListing = store.platformMode === 'listing';
    const defaultTitle = isListing
      ? `${store.storeName} - Book on Stora`
      : `${store.storeName} - Quality Products Online`;
    const defaultDescription = isListing
      ? `Find and contact ${store.storeName} on Stora. ${store.storeDescription || ''}`.trim()
      : `Shop quality products at ${store.storeName}. ${store.storeDescription || ''}`.trim();

    return {
      title: seoSettings.meta_title || defaultTitle,
      description: seoSettings.meta_description || defaultDescription,
      keywords: seoSettings.keywords?.join(', ') || '',
      alternates: {
        canonical: canonicalUrl,
      },
      icons: {
        icon: store.branding?.logo || '/favicon.ico',
        apple: store.branding?.logo || '/favicon.ico',
      },
      openGraph: {
        title: seoSettings.meta_title || defaultTitle,
        description: seoSettings.meta_description || defaultDescription,
        url: canonicalUrl,
        images: [store.branding?.banner || store.branding?.logo || '/og-image.jpg'],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: seoSettings.meta_title || defaultTitle,
        description: seoSettings.meta_description || defaultDescription,
        images: [store.branding?.banner || store.branding?.logo || '/og-image.jpg'],
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Stora Store',
      description: 'Your marketplace for artisan products'
    };
  }
}

// Make this a Server Component
export default async function StorePage({ params }) {
  const { slug } = await params;

  // findStoreByWebsitePath re-throws on a genuine DB error (its own
  // comment: "let the page handle it gracefully") -- generateMetadata
  // above already catches this same call and degrades cleanly; this page
  // component didn't, so a transient Supabase error crashed straight into
  // Next's generic (unbranded) error page instead of this app's own
  // not-found UI. No app/error.js boundary exists to catch it otherwise.
  let store;
  try {
    store = await findStoreByWebsitePath(slug);
  } catch (error) {
    console.error('Error loading store page:', error);
    notFound();
  }

  if (!store) notFound();

  const canonicalUrl = `https://stora.com.ng/${store.publicSlug || slug}`;
  const primaryImage = store.branding?.banner || store.branding?.logo || 'https://stora.com.ng/stora2.png';
  const storeSchema = {
    '@context': 'https://schema.org',
    '@type': store.platformMode === 'listing' ? 'LocalBusiness' : 'Store',
    name: store.storeName,
    url: canonicalUrl,
    image: [primaryImage],
    description: store.storeDescription || `Discover ${store.storeName} on Stora.`,
    telephone: store.storePhone || undefined,
    email: store.storeEmail || undefined,
    address: store.address
      ? {
          '@type': 'PostalAddress',
          addressLocality: store.state || undefined,
          streetAddress: store.address,
          addressCountry: 'NG',
        }
      : undefined,
  };

  // Listing-mode stores: active subscription required to be publicly visible.
  if (store.platformMode === 'listing') {
    if (store.subscriptionStatus !== 'active') {
      notFound();
    }
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(storeSchema) }} />
        <ListingShowcase store={store} />
      </>
    );
  }

  if (!store.website?.isEnabled) {
    notFound();
  }

  const gallery = await findGalleryByStoreId(store.id);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(storeSchema) }} />
      <StoreWebsite store={store} gallery={gallery} />
    </>
  );
}
