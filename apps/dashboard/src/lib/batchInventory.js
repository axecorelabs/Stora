import crypto from 'crypto';
import { supabaseAdmin } from './supabase';

// Resolve inventory + variant identity for a whole batch of line items in
// bulk: one query for every inventory row involved, one query for every
// active variant across those inventory rows, matched in JS by
// (inventory_id, size, color). Replaces what used to be up to 2 queries
// PER item (an inventory select + a conditional variant select).
async function resolveInventoryAndVariants(saleItems) {
  const inventoryIds = [...new Set(saleItems.map(i => i.inventoryId))];

  const { data: inventoryRows, error: invError } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .in('id', inventoryIds);

  if (invError) {
    throw new Error(`Failed to fetch inventory: ${invError.message}`);
  }

  const inventoryById = new Map((inventoryRows || []).map(row => [row.id, row]));
  for (const id of inventoryIds) {
    if (!inventoryById.has(id)) {
      throw new Error(`Inventory item not found: ${id}`);
    }
  }

  const { data: variantRows, error: varError } = await supabaseAdmin
    .from('inventory_variants')
    .select('id, sku, images, inventory_id, size, color')
    .in('inventory_id', inventoryIds)
    .eq('is_active', true);

  if (varError) {
    throw new Error(`Failed to fetch variants: ${varError.message}`);
  }

  const variantByKey = new Map(
    (variantRows || []).map(v => [`${v.inventory_id}|${v.size}|${v.color}`, v])
  );

  return { inventoryById, variantByKey };
}

function resolveVariantInfo(saleItem, variantByKey) {
  const requestedVariant = saleItem.variant && saleItem.variant.size && saleItem.variant.color ? saleItem.variant : null;

  if (!requestedVariant) {
    return { hasVariant: false, size: null, color: null, variantSku: null, variantId: null, images: [] };
  }

  const resolved = variantByKey.get(`${saleItem.inventoryId}|${requestedVariant.size}|${requestedVariant.color}`);
  if (!resolved) {
    throw new Error(`Variant ${requestedVariant.color} - ${requestedVariant.size} not found for item ${saleItem.inventoryId}`);
  }

  return {
    hasVariant: true,
    size: requestedVariant.size,
    color: requestedVariant.color,
    variantSku: resolved.sku,
    variantId: resolved.id,
    images: resolved.images || []
  };
}

// Shapes one RPC result row into what callers (sale_items rows, receipts,
// cost/profit reporting) expect -- unchanged from the old per-item
// implementation, just fed from a bulk RPC row instead of a single-item one.
function buildProcessedResult(saleItem, inventoryItem, variantInfo, rpcRow) {
  const rpcBatches = rpcRow.batches || [];
  let totalCost = 0;
  let totalProfit = 0;

  const batchesSoldFrom = rpcBatches.map(b => {
    const costPriceFromBatch = parseFloat(b.cost_price ?? inventoryItem.cost ?? 0);
    totalCost += b.quantity * costPriceFromBatch;
    totalProfit += b.quantity * (saleItem.unitPrice - costPriceFromBatch);
    return {
      batchId: b.batch_id,
      batchCode: b.batch_code,
      quantityFromBatch: b.quantity,
      costPriceFromBatch,
      batchVariant: variantInfo.hasVariant
        ? { size: variantInfo.size, color: variantInfo.color, variantSku: variantInfo.variantSku }
        : null
    };
  });

  // Batches may under-cover the requested quantity (e.g. a legacy item with
  // no batch records) -- fall back to the inventory-level cost price for
  // whatever wasn't traceable to a specific batch, same as before.
  const coveredQuantity = rpcBatches.reduce((sum, b) => sum + b.quantity, 0);
  const uncovered = saleItem.quantity - coveredQuantity;
  if (uncovered > 0) {
    const fallbackCostPrice = parseFloat(inventoryItem.cost || 0);
    totalCost += uncovered * fallbackCostPrice;
    totalProfit += uncovered * (saleItem.unitPrice - fallbackCostPrice);
    console.warn(`No batch coverage for ${uncovered} units of ${inventoryItem.name}, using inventory cost price`);
  }

  const processedItem = {
    inventoryId: saleItem.inventoryId,
    productName: saleItem.productName || inventoryItem.name,
    sku: saleItem.sku || inventoryItem.sku,
    quantity: saleItem.quantity,
    unitPrice: saleItem.unitPrice,
    total: saleItem.total,
    variant: variantInfo,
    batchesSoldFrom,
    costBreakdown: {
      totalCost,
      weightedAverageCost: saleItem.quantity > 0 ? totalCost / saleItem.quantity : 0,
      profit: totalProfit
    }
  };

  const saleItemData = {
    id: crypto.randomUUID(),
    inventory_id: saleItem.inventoryId,
    product_name: saleItem.productName || inventoryItem.name,
    sku: saleItem.sku || inventoryItem.sku,
    quantity: saleItem.quantity,
    unit_price: saleItem.unitPrice,
    total: saleItem.total,
    total_cost: totalCost,
    weighted_average_cost: saleItem.quantity > 0 ? totalCost / saleItem.quantity : 0,
    profit: totalProfit,
    variant_info: variantInfo.hasVariant ? variantInfo : null,
    batches_sold_from: batchesSoldFrom.length > 0 ? batchesSoldFrom : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return { processedItem, saleItemData, batchesUsed: rpcBatches.length, totalCost, totalProfit };
}

// Process a whole order's/sale's line items against inventory/variant/batch
// records in ONE Postgres round trip: batch-resolves identity (2 queries
// total, not 2 per item, see resolveInventoryAndVariants above), then calls
// fn_fulfill_stock_reservations_bulk (isOrderProcessing=true: converts
// reservations made at checkout into a real sale) or
// fn_sell_stock_direct_bulk (isOrderProcessing=false: a POS sale with no
// prior reservation) once for every item
// (apps/dashboard/supabase/migrations/20260815000000_bulk_stock_reservation_functions.sql).
// Replaces the old per-item processItemWithBatchTracking loop, which was
// up to 3 sequential DB round trips (inventory select, variant select, RPC
// call) PER line item -- real latency on a multi-item order at rush hour.
// Returns an array of results in saleItems order, same per-item shape the
// old function always returned.
export async function processItemsWithBatchTracking(saleItems, userId, isOrderProcessing = false) {
  if (!saleItems || saleItems.length === 0) return [];

  const { inventoryById, variantByKey } = await resolveInventoryAndVariants(saleItems);

  const itemContexts = saleItems.map(saleItem => {
    const inventoryItem = inventoryById.get(saleItem.inventoryId);
    const variantInfo = resolveVariantInfo(saleItem, variantByKey);
    const reasonSuffix = variantInfo.hasVariant
      ? `(${variantInfo.color} - ${variantInfo.size}) via ${isOrderProcessing ? 'order fulfillment' : 'POS'}`
      : `via ${isOrderProcessing ? 'order fulfillment' : 'POS'}`;
    const reason = `Sold: ${saleItem.quantity} ${inventoryItem.unit_of_measure || 'unit'} ${reasonSuffix}`;
    return { saleItem, inventoryItem, variantInfo, reason };
  });

  const rpcItems = itemContexts.map(({ saleItem, variantInfo, reason }) => ({
    inventory_id: saleItem.inventoryId,
    variant_id: variantInfo.variantId,
    quantity: saleItem.quantity,
    reason
  }));

  const rpcName = isOrderProcessing ? 'fn_fulfill_stock_reservations_bulk' : 'fn_sell_stock_direct_bulk';
  // p_related_order_id/p_related_sale_id are null here, matching what this
  // code always passed before batching -- the sale/order-linkage row this
  // would reference is created by the caller AFTER this function returns
  // (it needs totals this function computes), so there's nothing to link
  // to yet at this point in either call site.
  const rpcParams = isOrderProcessing
    ? { p_items: rpcItems, p_user_id: userId, p_related_order_id: null }
    : { p_items: rpcItems, p_user_id: userId, p_related_sale_id: null };

  const { data, error } = await supabaseAdmin.rpc(rpcName, rpcParams);

  if (error) {
    // fn_sell_stock_direct_bulk raises 'INSUFFICIENT_STOCK item_idx=N
    // shortfall=M' on the first out-of-stock item, rolling back the whole
    // batch atomically -- map it back to which line item for the message.
    const shortfallMatch = /INSUFFICIENT_STOCK item_idx=(\d+) shortfall=(\d+)/.exec(error.message || '');
    if (shortfallMatch) {
      const idx = parseInt(shortfallMatch[1], 10);
      const shortfall = parseInt(shortfallMatch[2], 10);
      const name = itemContexts[idx]?.inventoryItem?.name || itemContexts[idx]?.saleItem?.inventoryId;
      throw new Error(`Insufficient stock for ${name}. Need ${shortfall} more units.`);
    }
    throw new Error(`Failed to process stock: ${error.message}`);
  }

  const rowByIdx = new Map((data || []).map(row => [row.idx, row]));

  return itemContexts.map((ctx, idx) => {
    const rpcRow = rowByIdx.get(idx);
    if (!rpcRow) {
      throw new Error(`No stock-processing result returned for ${ctx.inventoryItem.name}`);
    }
    return buildProcessedResult(ctx.saleItem, ctx.inventoryItem, ctx.variantInfo, rpcRow);
  });
}

// Release previously-reserved quantities for a whole set of items (e.g.
// every item on a cancelled order) in one round trip via
// fn_release_stock_reservations_bulk, instead of one RPC call per item.
// `items` is [{inventoryId, quantity, variant: {variantId?, size?, color?}}].
export async function releaseItemsReservation(items) {
  if (!items || items.length === 0) return;

  const needsResolve = items.filter(i => !i.variant?.variantId && i.variant?.size && i.variant?.color);
  let variantByKey = new Map();
  if (needsResolve.length > 0) {
    const inventoryIds = [...new Set(needsResolve.map(i => i.inventoryId))];
    const { data: variantRows } = await supabaseAdmin
      .from('inventory_variants')
      .select('id, inventory_id, size, color')
      .in('inventory_id', inventoryIds)
      .eq('is_active', true);
    variantByKey = new Map((variantRows || []).map(v => [`${v.inventory_id}|${v.size}|${v.color}`, v]));
  }

  const rpcItems = items.map(i => {
    let variantId = i.variant?.variantId || null;
    if (!variantId && i.variant?.size && i.variant?.color) {
      variantId = variantByKey.get(`${i.inventoryId}|${i.variant.size}|${i.variant.color}`)?.id || null;
    }
    return { inventory_id: i.inventoryId, variant_id: variantId, quantity: i.quantity };
  });

  const { error } = await supabaseAdmin.rpc('fn_release_stock_reservations_bulk', { p_items: rpcItems });
  if (error) {
    throw new Error(`Failed to release reservations: ${error.message}`);
  }
}
