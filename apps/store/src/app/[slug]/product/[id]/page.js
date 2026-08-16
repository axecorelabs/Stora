import { notFound } from 'next/navigation';
import ProductDetailsClient from '@/components/product/ProductDetailsClient';
import { findStoreBySlug, findInventoryById, findActiveBatchesByInventoryId, calculateBatchQuantities } from '@/lib/supabaseStore';

// ISR: this page's price/stock display (FIFO batch pricing) is the most
// change-sensitive of the three storefront pages and has no client-side
// refresh on top of it (unlike the listing page's useProducts hook), so it
// gets the shortest window. A short-lived stale "in stock"/price here is a
// display-only risk, not a money-loss one -- checkout still re-validates
// real availability atomically at reservation time
// (apps/store/src/lib/supabaseOrders.js reserveStock ->
// fn_reserve_stock), which is what actually prevents overselling.
export const revalidate = 30;

// Required for revalidate to take effect on this dynamic segment -- see
// the matching comment in [slug]/page.js.
export async function generateStaticParams() {
  return [];
}

// Generate metadata for SEO and social sharing
export async function generateMetadata({ params }) {
  try {
    const { slug, id } = await params;
    
    // Fetch store from Supabase
    const store = await findStoreBySlug(slug);

    if (!store) {
      return { title: 'Product Not Found' };
    }

    // Fetch product from Supabase
    const product = await findInventoryById(id);

    if (!product || !product.isActive || product.storeId !== store.id) {
      return { title: 'Product Not Found' };
    }

    // Get batches for accurate pricing
    const batches = await findActiveBatchesByInventoryId(id);
    const batchesWithQuantities = await calculateBatchQuantities(batches);

    // Filter to only batches with stock (accounting for sold and reserved)
    const activeBatches = batchesWithQuantities.filter(batch => batch.actualQuantityRemaining > 0);
    const currentActiveBatch = activeBatches.length > 0 ? activeBatches[0] : null;

    // Use batch pricing if available
    const currentPrice = currentActiveBatch ? currentActiveBatch.sellingPrice : product.sellingPrice;
    const totalAvailableQuantity = activeBatches.length > 0 
      ? activeBatches.reduce((sum, batch) => sum + batch.actualQuantityRemaining, 0)
      : product.availableQuantity || 0;

    const title = `${product.productName} - ${store.storeName}`;
    const description = product.description || `Buy ${product.productName} at ${store.storeName}. Category: ${product.category}.`;
    const productImageUrl = product.image || store.branding?.logo || '/og-image.jpg';

    return {
      title,
      description,
      keywords: [product.productName, product.category, product.brand, store.storeName, 'buy online'].filter(Boolean).join(', '),
      icons: {
        icon: product.image || store.branding?.logo || '/favicon.ico',
        apple: product.image || store.branding?.logo || '/favicon.ico',
      },
      openGraph: {
        title,
        description,
        images: [
          {
            url: productImageUrl,
            width: 1200,
            height: 630,
            alt: product.productName,
          }
        ],
        siteName: store.storeName,
        locale: 'en_US',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [productImageUrl],
      },
      other: {
        'product:price:amount': currentPrice?.toString(),
        'product:price:currency': store.settings?.currency || 'NGN',
        'product:availability': totalAvailableQuantity > 0 ? 'in stock' : 'out of stock',
        'product:category': product.category,
        'product:brand': product.brand || store.storeName,
        'og:type': 'product',
      }
    };
  } catch (error) {
    console.error('Error generating product metadata:', error);
    return { title: 'Product' };
  }
}

// Server Component
export default async function ProductPage({ params }) {
  const { slug, id } = await params;
  
  // Fetch store from Supabase
  const store = await findStoreBySlug(slug);

  if (!store) {
    notFound();
  }

  // Fetch product from Supabase
  const product = await findInventoryById(id);

  if (!product || !product.isActive || product.storeId !== store.id) {
    notFound();
  }

  // Get ALL batches for this product, sorted by FIFO (dateReceived ascending)
  const batches = await findActiveBatchesByInventoryId(id);

  // Calculate actual remaining quantities (accounting for sold and reserved)
  const batchesWithActualRemaining = await calculateBatchQuantities(batches);

  // Filter to ONLY batches that have stock
  const activeBatches = batchesWithActualRemaining.filter(batch => batch.actualQuantityRemaining > 0);

  // Find the current active batch using FIFO logic (first batch with stock)
  const currentActiveBatch = activeBatches.length > 0 ? activeBatches[0] : null;

  // Calculate batch-based pricing and availability
  let currentPrice = product.sellingPrice; // fallback
  let totalAvailableQuantity = 0;
  let priceRange = { min: null, max: null };
  let hasBatches = activeBatches.length > 0;

  if (currentActiveBatch) {
    // Use the FIRST batch with stock (FIFO) for current pricing
    const currentPrice = currentActiveBatch.selling_price;
    
    // Calculate total available quantity from all batches with stock
    totalAvailableQuantity = activeBatches.reduce((sum, batch) => sum + batch.actualQuantityRemaining, 0);
    
    // Calculate price range across all active batches
    const prices = activeBatches.map(batch => batch.selling_price);
    priceRange = {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  } else {
    // No active batches with stock, use available quantity (accounting for reservations)
    totalAvailableQuantity = product.availableQuantity || 0;
  }

  // Calculate weighted averages across all batches (for reference)
  const totalQuantityIn = batchesWithActualRemaining.reduce((sum, batch) => sum + (batch.quantity_in || 0), 0);
  const weightedSellingSum = batchesWithActualRemaining.reduce((sum, batch) => 
    sum + ((batch.selling_price || 0) * (batch.quantity_in || 0)), 0
  );
  const averageSellingPrice = totalQuantityIn > 0 ? weightedSellingSum / totalQuantityIn : currentPrice;

  // Transform images array to proper format
  // Handle multiple cases: array of URL strings, array of image objects, OR array of JSON strings
  const transformedImages = product.images && Array.isArray(product.images) && product.images.length > 0
    ? product.images
        .map((img) => {
          // If it's a JSON string, parse it first
          if (typeof img === 'string') {
            try {
              // Try to parse as JSON
              const parsed = JSON.parse(img);
              if (parsed.url) {
                return parsed;
              }
              // If not JSON, treat as URL string
              return img;
            } catch {
              // Not JSON, treat as URL string
              return img;
            }
          }
          // Already an object
          return img;
        })
        .filter(img => img && (typeof img === 'string' ? img.trim() : img.url))
        .map((img, index) => {
          // If already an object with url property, use it
          if (typeof img === 'object' && img.url) {
            return {
              url: img.url,
              isPrimary: img.isPrimary || index === 0,
              colorTag: img.colorTag || '',
              altText: img.altText || product.productName
            };
          }
          // If it's a string URL, create the object
          return {
            url: img,
            isPrimary: index === 0 || img === product.image,
            colorTag: '',
            altText: product.productName
          };
        })
    : product.image
      ? [{ 
          url: product.image, 
          isPrimary: true, 
          colorTag: '', 
          altText: product.productName 
        }]
      : [];

  // Prepare enhanced product data with batch pricing
  const enhancedProduct = {
    ...product,
    // Use transformed images
    images: transformedImages,
    // Override pricing with CURRENT BATCH pricing (FIFO)
    sellingPrice: currentPrice,
    
    // Override quantity with total available from all batches
    quantityInStock: totalAvailableQuantity,
    
    // Include ALL category-specific details
    categoryDetails: {
      clothing: product.clothingDetails,
      shoes: product.shoesDetails,
      accessories: product.accessoriesDetails,
      perfume: product.perfumeDetails,
      food: product.foodDetails,
      beverages: product.beveragesDetails,
      electronics: product.electronicsDetails,
      books: product.booksDetails,
      homeGarden: product.homeGardenDetails,
      sports: product.sportsDetails,
      automotive: product.automotiveDetails,
      healthBeauty: product.healthBeautyDetails
    },
    
    // Batch information - only include batches with actual stock
    batches: activeBatches.map(batch => ({
      id: batch.id,
      batchCode: batch.batch_code,
      quantityIn: batch.quantity_in,
      quantitySold: batch.quantity_sold,
      quantityReserved: batch.quantity_reserved,
      quantityRemaining: batch.actualQuantityRemaining,
      sellingPrice: batch.selling_price,
      dateReceived: batch.date_received,
      expiryDate: batch.expiry_date,
      supplier: batch.supplier,
      isExpired: batch.expiry_date ? new Date(batch.expiry_date) < new Date() : false,
      daysUntilExpiry: batch.expiry_date ? Math.ceil((new Date(batch.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : null,
      isCurrentBatch: currentActiveBatch ? batch.id === currentActiveBatch.id : false
    })),
    
    // Batch metadata
    batchInfo: {
      hasBatches: hasBatches,
      totalBatches: activeBatches.length,
      totalAvailableQuantity,id,
      currentBatchCode: currentActiveBatch?.batch_code,
      currentBatchRemaining: currentActiveBatch ? currentActiveBatch.actualQuantityRemaining : 0,
      priceRange: activeBatches.length > 0 ? priceRange : null,
      oldestBatchDate: activeBatches.length > 0 ? activeBatches[0]?.date_received : null,
      newestBatchDate: activeBatches.length > 0 ? activeBatches[activeBatches.length - 1]?.date_received : null,
      // newestBatchDate: activeBatches.length > 0 ? activeBatches[activeBatches.length - 1]?.dateReceived : null,
      averagePrice: averageSellingPrice,
      methodology: 'FIFO - First In, First Out (oldest batches sold first)'
    },
    
    // Pricing information
    pricing: {
      current: currentPrice, // Current selling price from FIFO batch
      average: averageSellingPrice, // Weighted average across all batches
      hasVariablePricing: priceRange && priceRange.min !== priceRange.max,
      range: priceRange
    }
  };

  // Convert to plain objects
  const storeData = JSON.parse(JSON.stringify(store));
  const productData = JSON.parse(JSON.stringify(enhancedProduct));

  return <ProductDetailsClient store={storeData} product={productData} slug={slug} />;
}
