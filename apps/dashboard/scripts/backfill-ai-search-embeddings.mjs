// One-time backfill: embeds every existing product/store that predates AI
// search (new saves embed themselves automatically via the after() hooks
// in api/inventory and api/stores). Safe to re-run -- only processes rows
// where embedding IS NULL, so an interrupted run just picks up where it
// left off.
//
// Usage: node --env-file=.env.local scripts/backfill-ai-search-embeddings.mjs

import { supabaseAdmin } from '../src/lib/supabase.js';
import { embedText, buildProductEmbeddingText, buildStoreEmbeddingText } from '../src/lib/openrouter.js';

const BATCH_SIZE = 50;
// OpenRouter rate limits are per-account, not per-app -- pace requests
// rather than firing hundreds at once.
const DELAY_MS = 200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function backfillProducts() {
  let embedded = 0;
  let failed = 0;

  while (true) {
    const { data: products, error } = await supabaseAdmin
      .from('inventory')
      .select('id, name, category, brand, description')
      .is('embedding', null)
      .eq('is_deleted', false)
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!products || products.length === 0) break;

    for (const product of products) {
      const text = buildProductEmbeddingText({
        name: product.name,
        category: product.category,
        brand: product.brand,
        description: product.description
      });
      const embedding = await embedText(text);
      if (!embedding) {
        failed += 1;
        console.error(`Failed to embed product ${product.id}`);
        continue;
      }
      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({ embedding })
        .eq('id', product.id);
      if (updateError) {
        failed += 1;
        console.error(`Failed to store embedding for product ${product.id}:`, updateError);
      } else {
        embedded += 1;
      }
      await sleep(DELAY_MS);
    }

    console.log(`Products: ${embedded} embedded, ${failed} failed so far...`);
  }

  return { embedded, failed };
}

async function backfillStores() {
  let embedded = 0;
  let failed = 0;

  while (true) {
    const { data: stores, error } = await supabaseAdmin
      .from('stores')
      .select('id, store_name, store_description')
      .is('embedding', null)
      .eq('is_active', true)
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!stores || stores.length === 0) break;

    for (const store of stores) {
      const text = buildStoreEmbeddingText({
        storeName: store.store_name,
        storeDescription: store.store_description
      });
      const embedding = await embedText(text);
      if (!embedding) {
        failed += 1;
        console.error(`Failed to embed store ${store.id}`);
        continue;
      }
      const { error: updateError } = await supabaseAdmin
        .from('stores')
        .update({ embedding })
        .eq('id', store.id);
      if (updateError) {
        failed += 1;
        console.error(`Failed to store embedding for store ${store.id}:`, updateError);
      } else {
        embedded += 1;
      }
      await sleep(DELAY_MS);
    }

    console.log(`Stores: ${embedded} embedded, ${failed} failed so far...`);
  }

  return { embedded, failed };
}

(async () => {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is not set -- aborting.');
    process.exit(1);
  }

  console.log('Backfilling product embeddings...');
  const productResult = await backfillProducts();
  console.log('Products done:', productResult);

  console.log('Backfilling store embeddings...');
  const storeResult = await backfillStores();
  console.log('Stores done:', storeResult);
})().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
