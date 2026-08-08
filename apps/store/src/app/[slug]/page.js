import { notFound } from 'next/navigation';
import StoreWebsite from "@/components/StoreWebsite";
import { findStoreByWebsitePath } from '@/lib/supabaseStore';

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

    const seoSettings = store.ivma_website?.seo_settings || {};
    
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
      title: 'IVMA Store',
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
