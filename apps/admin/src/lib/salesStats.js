// "Sales" for a vendor is never one number in this codebase -- online
// orders (order_items/orders) and in-person POS sales (the separate
// `sales` table, keyed by user_id not store_id) are two independent
// channels, and stores.total_sales (which looked like the obvious single
// source) is confirmed dead: nothing has ever written to it since the
// initial schema.
//
// Computed via fn_admin_combined_sales (see
// apps/dashboard/supabase/migrations/20260902000001_admin_aggregate_functions.sql)
// -- one indexed, grouped SQL query, rather than pulling every order_item
// and every sale for these stores into JS and summing them here. Returns
// a Map<storeId, combinedTotal>.
export async function computeCombinedSales(supabaseAdmin, stores) {
  const storeIds = stores.map((s) => s.id);
  const totalByStore = new Map(storeIds.map((id) => [id, 0]));
  if (storeIds.length === 0) return totalByStore;

  const { data, error } = await supabaseAdmin.rpc('fn_admin_combined_sales', { p_store_ids: storeIds });
  if (error) throw error;

  (data || []).forEach((row) => {
    totalByStore.set(row.store_id, parseFloat(row.total_sales) || 0);
  });
  return totalByStore;
}
