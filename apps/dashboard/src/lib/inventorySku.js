import { supabaseAdmin } from './supabase';

// Generate a fallback SKU when the client doesn't supply one
export function generateSKU(category, name) {
  const catCode = (category || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase() || 'PRD';
  const nameCode = (name || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase() || 'ITM';
  const suffix = Date.now().toString(36).slice(-5).toUpperCase();
  return `${catCode}-${nameCode}-${suffix}`;
}

// Backfill missing SKUs on inventory rows created before SKU generation existed.
// Mutates and persists each row that's missing a sku, so callers can pass
// results straight from a `select('*')` and read back `item.sku` immediately.
export async function backfillMissingSkus(items) {
  const missing = items.filter(item => !item.sku);
  if (missing.length === 0) return items;

  await Promise.all(missing.map(async (item) => {
    const sku = generateSKU(item.category, item.name);
    const { error } = await supabaseAdmin
      .from('inventory')
      .update({ sku })
      .eq('id', item.id);

    if (error) {
      console.error(`Failed to backfill SKU for inventory item ${item.id}:`, error);
      return;
    }
    item.sku = sku;
  }));

  return items;
}
