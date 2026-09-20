import { supabaseAdmin } from './supabase.js';
import { BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY } from '@stora/shared-constants';

const ALL_BUSINESS_SUBCATEGORY_OPTIONS = Object.values(BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY).flat();

function subcategoryLabel(value) {
  return ALL_BUSINESS_SUBCATEGORY_OPTIONS.find((option) => option.value === value)?.label || value;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
const EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
// Requested at reduced dimensionality (the model's native output is 1536) --
// see the AI-search migration's own comment for why 512 is the deliberate
// choice here.
const EMBEDDING_DIMENSIONS = 512;

// Every embedding call is best-effort: a vendor saving a product/store must
// never be blocked or slowed by an OpenRouter round trip or outage. Callers
// always invoke this via after() (deferred, post-response) and simply leave
// embedding NULL on any failure -- that row just doesn't surface in AI
// search yet, and gets another chance on the next save.
export async function embedText(text) {
  if (!text || !text.trim()) return null;
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY not set -- skipping embedding');
    return null;
  }

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS
      })
    });

    if (!response.ok) {
      console.error('OpenRouter embedding request failed:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;
    return Array.isArray(embedding) ? embedding : null;
  } catch (error) {
    console.error('Error calling OpenRouter embeddings:', error);
    return null;
  }
}

// Same text a product's AI-search match is actually judged against --
// nulls coalesced so a product with no description/brand yet still embeds
// on name + category alone rather than skipping embedding entirely.
export function buildProductEmbeddingText({ name, category, brand, description }) {
  return [name, category, brand, description].filter(Boolean).join(' ');
}

// Previously just storeName+storeDescription -- AI vendor search's
// retrieval step ranks purely by embedding similarity (see
// search_vendors_ai's ORDER BY s.embedding <=> p_embedding) before any
// keyword reranking happens, so a business whose bio never restates what
// it actually sells/does was invisible to that step no matter how well its
// services/products matched the query. serviceTexts carries what a
// listing/service business offers -- service_items have no embedding of
// their own, so this is the ONLY AI-searchable signal for them at all.
// productCategories/productBrands are deliberately just the distinct set,
// not every product name -- products already have their own per-item
// embeddings and search path (searchProductsByEmbedding); this only needs
// to signal "what kind of store is this" for vendor-level search, not
// duplicate the full catalog.
export function buildStoreEmbeddingText({
  storeName,
  storeDescription,
  businessCategory,
  businessSubcategories = [],
  serviceTexts = [],
  productCategories = [],
  productBrands = []
}) {
  const subcategoryLabels = [...new Set(businessSubcategories.filter(Boolean))].map(subcategoryLabel);
  return [
    storeName,
    storeDescription,
    businessCategory,
    ...subcategoryLabels,
    ...serviceTexts,
    ...productCategories,
    ...productBrands
  ].filter(Boolean).join(' ');
}

export async function embedProductById(productId) {
  const { data: product, error } = await supabaseAdmin
    .from('inventory')
    .select('id, name, category, brand, description')
    .eq('id', productId)
    .single();

  if (error || !product) {
    console.error('embedProductById: product not found', productId, error);
    return;
  }

  const embedding = await embedText(buildProductEmbeddingText({
    name: product.name,
    category: product.category,
    brand: product.brand,
    description: product.description
  }));
  if (!embedding) return;

  const { error: updateError } = await supabaseAdmin
    .from('inventory')
    .update({ embedding })
    .eq('id', productId);
  if (updateError) console.error('embedProductById: failed to store embedding', productId, updateError);
}

// Active service items this store offers -- name/category/sub_category is
// the same text the storefront's own service cards show, and the closest
// thing to a "what do they do" description a service business has. Capped
// at 30 items: plenty for any real business's own service menu, without
// letting an outlier blow up the embed text.
async function loadActiveServiceTexts(storeId) {
  const { data: service } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .maybeSingle();
  if (!service) return [];

  const { data: items } = await supabaseAdmin
    .from('service_items')
    .select('name, category, sub_category')
    .eq('service_id', service.id)
    .eq('is_active', true)
    .limit(30);

  return (items || []).flatMap((item) => [item.name, item.category, item.sub_category]).filter(Boolean);
}

// Distinct categories/brands from this store's publicly visible catalog --
// same visibility rules search_vendors/search_vendors_ai already use
// (active, web-visible, not deleted), so the embedding never advertises a
// hidden/draft product's category as something this store is searchable
// for. Deduped and capped, not every product -- see buildStoreEmbeddingText.
async function loadActiveProductSignals(storeId) {
  const { data: items } = await supabaseAdmin
    .from('inventory')
    .select('category, brand')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .eq('web_visibility', true)
    .eq('is_deleted', false)
    .limit(500);

  const categories = [...new Set((items || []).map((item) => item.category).filter(Boolean))].slice(0, 15);
  const brands = [...new Set((items || []).map((item) => item.brand).filter(Boolean))].slice(0, 15);
  return { categories, brands };
}

export async function embedStoreById(storeId) {
  const { data: store, error } = await supabaseAdmin
    .from('stores')
    .select('id, store_name, store_description, business_category, business_subcategory, business_subcategories')
    .eq('id', storeId)
    .single();

  if (error || !store) {
    console.error('embedStoreById: store not found', storeId, error);
    return;
  }

  const [serviceTexts, productSignals] = await Promise.all([
    loadActiveServiceTexts(storeId),
    loadActiveProductSignals(storeId)
  ]);

  const embedding = await embedText(buildStoreEmbeddingText({
    storeName: store.store_name,
    storeDescription: store.store_description,
    businessCategory: store.business_category,
    businessSubcategories: [store.business_subcategory, ...(store.business_subcategories || [])],
    serviceTexts,
    productCategories: productSignals.categories,
    productBrands: productSignals.brands
  }));
  if (!embedding) return;

  const { error: updateError } = await supabaseAdmin
    .from('stores')
    .update({ embedding })
    .eq('id', storeId);
  if (updateError) console.error('embedStoreById: failed to store embedding', storeId, updateError);
}
