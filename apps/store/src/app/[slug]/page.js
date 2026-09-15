import { notFound } from 'next/navigation';
import StoreWebsite from "@/components/StoreWebsite";
import ListingShowcase from "@/components/ListingShowcase";
import { findStoreByWebsitePath } from '@/lib/supabaseStore';

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
    
    return {
      title: seoSettings.meta_title || `${store.storeName} - Quality Products Online`,
      description: seoSettings.meta_description || `Shop quality products at ${store.storeName}. ${store.storeDescription}`,
      keywords: seoSettings.keywords?.join(', ') || '',
      icons: {
        icon: store.branding?.logo || '/favicon.ico',
        apple: store.branding?.logo || '/favicon.ico',
      },
      openGraph: {
        title: seoSettings.meta_title || `${store.storeName} - Quality Products Online`,
        description: seoSettings.meta_description || `Shop quality products at ${store.storeName}`,
        images: [store.branding?.banner || store.branding?.logo || '/og-image.jpg'],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: seoSettings.meta_title || `${store.storeName} - Quality Products Online`,
        description: seoSettings.meta_description || `Shop quality products at ${store.storeName}`,
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

  // Fetch store using Supabase
  const store = await findStoreByWebsitePath(slug);

  if (!store) notFound();

  // Listing-mode stores: active subscription required to be publicly visible.
  if (store.platformMode === 'listing') {
    if (store.subscriptionStatus !== 'active') {
      notFound();
    }
    return <ListingShowcase store={store} />;
  }

  if (!store.website?.isEnabled) {
    notFound();
  }

  return <StoreWebsite store={store} />;
}
