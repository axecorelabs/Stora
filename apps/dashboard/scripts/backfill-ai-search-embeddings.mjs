// One-time backfill: embeds every existing product/store that predates AI
// search (new saves embed themselves automatically via the after() hooks
// in api/inventory, api/services, and api/stores). Safe to re-run -- by
// default only processes rows where embedding IS NULL, so an interrupted
// run just picks up where it left off.
//
// Usage: node --env-file=.env.local scripts/backfill-ai-search-embeddings.mjs
//        node --env-file=.env.local scripts/backfill-ai-search-embeddings.mjs --refresh-stores
//
// --refresh-stores re-embeds EVERY active store regardless of whether it
// already has an embedding -- needed once (and only once) after
// buildStoreEmbeddingText's own formula changes, since an existing
// embedding computed under the old formula still looks "done" by the
// IS NULL check above and would otherwise never get the new signal
// (business category, services, product categories/brands) without this.

import { supabaseAdmin } from '../src/lib/supabase.js';
import { embedText, buildProductEmbeddingText, embedStoreById } from '../src/lib/openrouter.js';

const REFRESH_ALL_STORES = process.argv.includes('--refresh-stores');

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

// Delegates to embedStoreById (openrouter.js) rather than rebuilding the
// text/API-call logic here -- that function is also where the actual
// signal-gathering (business category, active services, product
// categories/brands) lives, and duplicating it here is exactly how this
// script went stale the first time (see the file's top comment).
async function backfillStores({ refreshAll }) {
  let embedded = 0;
  let failed = 0;

  if (!refreshAll) {
    // The IS NULL case: rows only ever leave this set (embedStoreById fills
    // them in), so plain re-querying the same "still null" filter each page
    // is safe -- no cursor needed, an interrupted run just re-queries the
    // same remaining set next time.
    while (true) {
      const { data: stores, error } = await supabaseAdmin
        .from('stores')
        .select('id')
        .is('embedding', null)
        .eq('is_active', true)
        .limit(BATCH_SIZE);

      if (error) throw error;
      if (!stores || stores.length === 0) break;

      for (const store of stores) {
        try {
          await embedStoreById(store.id);
          embedded += 1;
        } catch (embedError) {
          failed += 1;
          console.error(`Failed to embed store ${store.id}:`, embedError);
        }
        await sleep(DELAY_MS);
      }

      console.log(`Stores: ${embedded} embedded, ${failed} failed so far...`);
    }

    return { embedded, failed };
  }

  // --refresh-stores: every row gets reprocessed regardless of its current
  // embedding, so the query itself can't distinguish "done" from "not done"
  // the way the IS NULL case can. Keyset (cursor) pagination on id -- not
  // offset -- so this stays correct and fast at any table size: an offset
  // page re-scans and discards everything before it every single call,
  // which gets slower with every page at real scale (10k+ rows), while a
  // keyset page is a single indexed lookup regardless of how far in it is.
  let afterId = '00000000-0000-0000-0000-000000000000';
  while (true) {
    const { data: stores, error } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('is_active', true)
      .gt('id', afterId)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!stores || stores.length === 0) break;

    for (const store of stores) {
      try {
        await embedStoreById(store.id);
        embedded += 1;
      } catch (embedError) {
        failed += 1;
        console.error(`Failed to embed store ${store.id}:`, embedError);
      }
      await sleep(DELAY_MS);
    }

    afterId = stores[stores.length - 1].id;
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

  console.log(REFRESH_ALL_STORES ? 'Refreshing ALL store embeddings...' : 'Backfilling store embeddings...');
  const storeResult = await backfillStores({ refreshAll: REFRESH_ALL_STORES });
  console.log('Stores done:', storeResult);
})().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
