import { notFound } from 'next/navigation';
import StoreWebsite from "@/components/StoreWebsite";
import { findStoreByWebsitePath } from '@/lib/supabaseStore';

// ISR: this Server Component's data fetch (a plain Supabase query, not
// Next's fetch()) is otherwise invisible to Next's cache -- without this,
// every visit re-hits Postgres. Store branding/description changes rarely,
// so a 5-minute window is a safe default; vendor edits show up within that
// window rather than instantly (on-demand revalidation via revalidatePath()
// from the dashboard's store-settings update route would close that gap --
// not wired up yet).
export const revalidate = 300;

// Required for revalidate to actually take effect on a dynamic segment: an
// empty array means "prerender nothing at build time" (the catalog of
// store slugs isn't known/fixed at build time), but it's what tells Next
// to treat requests as ISR (cache + background-regenerate) instead of
// plain per-request SSR. Without this, `revalidate` above is silently a
// no-op -- confirmed by testing (every request re-ran the page function).
export async function generateStaticParams() {
  return [];
}

// Generate metadata for SEO and social sharing
export async function generateMetadata({ params }) {
  try {
    const { slug } = await params;
    
    // Fetch store by website path using Supabase
    const store = await findStoreByWebsitePath(slug);

    if (!store) {
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

  if (!store) {
    notFound();
  }

  return <StoreWebsite store={store} />;
}
