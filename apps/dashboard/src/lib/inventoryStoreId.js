import { supabaseAdmin } from './supabase';

// Backfill missing store_id on inventory rows created before the create route
// set it. The public storefront (apps/store) looks products up by store_id,
// so a row without one is invisible there no matter what else is correct --
// mutates and persists each row that's missing it, so callers can pass
// results straight from a `select('*')` and read back `item.store_id` immediately.
export async function backfillMissingStoreIds(items, userId) {
  const missing = items.filter(item => !item.store_id);
  if (missing.length === 0) return items;

  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .single();

  if (!store) return items;

  await Promise.all(missing.map(async (item) => {
    const { error } = await supabaseAdmin
      .from('inventory')
      .update({ store_id: store.id })
      .eq('id', item.id);

    if (error) {
      console.error(`Failed to backfill store_id for inventory item ${item.id}:`, error);
      return;
    }
    item.store_id = store.id;
  }));

  return items;
}
