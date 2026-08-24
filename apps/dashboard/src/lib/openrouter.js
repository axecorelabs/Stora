import { supabaseAdmin } from './supabase.js';

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

export function buildStoreEmbeddingText({ storeName, storeDescription }) {
  return [storeName, storeDescription].filter(Boolean).join(' ');
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

export async function embedStoreById(storeId) {
  const { data: store, error } = await supabaseAdmin
    .from('stores')
    .select('id, store_name, store_description')
    .eq('id', storeId)
    .single();

  if (error || !store) {
    console.error('embedStoreById: store not found', storeId, error);
    return;
  }

  const embedding = await embedText(buildStoreEmbeddingText({
    storeName: store.store_name,
    storeDescription: store.store_description
  }));
  if (!embedding) return;

  const { error: updateError } = await supabaseAdmin
    .from('stores')
    .update({ embedding })
    .eq('id', storeId);
  if (updateError) console.error('embedStoreById: failed to store embedding', storeId, updateError);
}
