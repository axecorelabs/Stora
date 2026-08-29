import crypto from 'crypto';
import { supabaseAdmin } from './supabase';
import { normalizeExtraDefinitions, resolveExtrasSelection } from '@stora/shared-constants';

// Resolve inventory + variant identity for a whole batch of line items in
// bulk: one query for every inventory row involved, one query for every
// active variant across those inventory rows, matched in JS by
// (inventory_id, size, color) when given, or -- since every product now
// has >=1 real variant row (20260817000001_unify_inventory_variants.sql)
// -- resolved to the product's sole variant when no size/color was
// specified at all. Every sale item now resolves to a real variant_id,
// never null.
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
    .select('id, sku, images, inventory_id, size, color, cost_price')
    .in('inventory_id', inventoryIds)
    .eq('is_active', true);

  if (varError) {
    throw new Error(`Failed to fetch variants: ${varError.message}`);
  }

  const variantByKey = new Map(
    (variantRows || []).map(v => [`${v.inventory_id}|${v.size}|${v.color}`, v])
  );
  const variantsByInventory = new Map();
  for (const v of variantRows || []) {
    if (!variantsByInventory.has(v.inventory_id)) variantsByInventory.set(v.inventory_id, []);
    variantsByInventory.get(v.inventory_id).push(v);
  }

  return { inventoryById, variantByKey, variantsByInventory };
}

function resolveVariantInfo(saleItem, variantByKey, variantsByInventory) {
  const requestedVariant = saleItem.variant && saleItem.variant.size && saleItem.variant.color ? saleItem.variant : null;

  if (requestedVariant) {
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
      costPrice: resolved.cost_price,
      images: resolved.images || []
    };
  }

  // No size/color given -- only unambiguous when the product has exactly
  // one variant (the common "simple product" case, which still has a real
  // variant row, just no real size/color options to pick between).
  const productVariants = variantsByInventory.get(saleItem.inventoryId) || [];
  if (productVariants.length !== 1) {
    throw new Error(
      productVariants.length > 1
        ? `Item ${saleItem.inventoryId} has multiple variants -- a size/color must be specified`
        : `Item ${saleItem.inventoryId} has no variant to sell`
    );
  }
  const only = productVariants[0];
  return {
    hasVariant: only.color !== 'Default' || only.size !== 'One Size',
    size: only.size,
    color: only.color,
    variantSku: only.sku,
    variantId: only.id,
    costPrice: only.cost_price,
    images: only.images || []
  };
}

// Shapes one RPC result row into what callers (sale_items rows, receipts,
// cost/profit reporting) expect -- unchanged from the old per-item
// implementation, just fed from a bulk RPC row instead of a single-item one.
function buildProcessedResult(saleItem, inventoryItem, variantInfo, rpcRow) {
  const rpcBatches = rpcRow.batches || [];
  let totalCost = 0;
  let totalProfit = 0;

  // NOTE: saleItem.unitPrice already includes any extras cost baked in
  // upstream (pos/page.js), and extras have no cost-of-goods tracking of
  // their own (no cost_price per extra anywhere) -- so 100% of extras
  // revenue reads as pure profit here. Accepted scope simplification:
  // pricing + limits were asked for, not extras COGS tracking.
  const batchesSoldFrom = rpcBatches.map(b => {
    const costPriceFromBatch = parseFloat(b.cost_price ?? variantInfo.costPrice ?? 0);
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
  // no batch records) -- fall back to the variant's own cost price for
  // whatever wasn't traceable to a specific batch.
  const coveredQuantity = rpcBatches.reduce((sum, b) => sum + b.quantity, 0);
  const uncovered = saleItem.quantity - coveredQuantity;
  if (uncovered > 0) {
    const fallbackCostPrice = parseFloat(variantInfo.costPrice || 0);
    totalCost += uncovered * fallbackCostPrice;
    totalProfit += uncovered * (saleItem.unitPrice - fallbackCostPrice);
    console.warn(`No batch coverage for ${uncovered} units of ${inventoryItem.name}, using variant cost price`);
  }

  const processedItem = {
    inventoryId: saleItem.inventoryId,
    productName: saleItem.productName || inventoryItem.name,
    sku: saleItem.sku || inventoryItem.sku,
    quantity: saleItem.quantity,
    unitPrice: saleItem.unitPrice,
    total: saleItem.total,
    variant: variantInfo,
    modifiers: saleItem.modifiers || null,
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
    variant_info: variantInfo,
    modifiers: saleItem.modifiers || null,
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
// prior reservation) once for every item, variant-scoped
// (apps/dashboard/supabase/migrations/20260817000002_variant_only_rpcs.sql).
// Returns an array of results in saleItems order, same per-item shape the
// old function always returned.
export async function processItemsWithBatchTracking(saleItems, userId, isOrderProcessing = false, relatedId = null) {
  if (!saleItems || saleItems.length === 0) return [];

  const { inventoryById, variantByKey, variantsByInventory } = await resolveInventoryAndVariants(saleItems);

  const itemContexts = saleItems.map(saleItem => {
    const inventoryItem = inventoryById.get(saleItem.inventoryId);
    const variantInfo = resolveVariantInfo(saleItem, variantByKey, variantsByInventory);
    const reasonSuffix = variantInfo.hasVariant
      ? `(${variantInfo.color} - ${variantInfo.size}) via ${isOrderProcessing ? 'order fulfillment' : 'POS'}`
      : `via ${isOrderProcessing ? 'order fulfillment' : 'POS'}`;
    const reason = `Sold: ${saleItem.quantity} ${inventoryItem.unit_of_measure || 'unit'} ${reasonSuffix}`;
    return { saleItem, inventoryItem, variantInfo, reason };
  });

  // Validate each item's requested extras against its own current
  // definitions -- defense-in-depth against a tampered/buggy request
  // (this route otherwise trusts saleItem.unitPrice/.total wholesale).
  // Scoped to fresh POS sales only: an order-fulfillment completion
  // (isOrderProcessing=true) is honoring a selection a customer already
  // made and paid for at checkout time (already validated there -- see
  // orders/create/route.js), which can legitimately reference an extra
  // whose maxQuantity a vendor has since lowered, without that being wrong.
  //
  // This deliberately does NOT recompute/compare the item's BASE price.
  // Two options were considered and rejected:
  // 1. Replicate the storefront's batch-price resolution
  //    (supabaseStore.js's resolveBatchPricing) here -- a separate, larger
  //    undertaking than this pass, not something to half-build.
  // 2. Compare against inventory_variants.price directly -- rejected after
  //    checking fn_create_batch (20260817000002_variant_only_rpcs.sql):
  //    adding a new batch updates quantity_in_stock but never touches
  //    variants.price, so a vendor re-batching at a new selling price
  //    leaves that column stale. A strict (or even tolerance-based)
  //    comparison against it would false-positive-reject perfectly
  //    legitimate sales the moment a vendor's real price has moved on from
  //    whatever variants.price last happened to hold -- worse than no
  //    check at all.
  // The known compounding-price bug this would have caught (POS
  // re-customizing a variant+extras line) is fixed at its source instead
  // (see pos/page.js's handleAddVariantToCart/handleSaveModifiers).
  if (!isOrderProcessing) {
    for (const ctx of itemContexts) {
      const extrasDefinitions = normalizeExtraDefinitions(ctx.inventoryItem.category_details?.food?.extras);
      const { errors } = resolveExtrasSelection(extrasDefinitions, ctx.saleItem.modifiers?.extras);
      if (errors.length > 0) {
        throw new Error(`${ctx.inventoryItem.name}: ${errors.join('; ')}`);
      }
    }
  }

  const rpcItems = itemContexts.map(({ saleItem, variantInfo, reason }) => ({
    variant_id: variantInfo.variantId,
    quantity: saleItem.quantity,
    reason
  }));

  const rpcName = isOrderProcessing ? 'fn_fulfill_stock_reservations_bulk' : 'fn_sell_stock_direct_bulk';
  // Order fulfillment: the order already exists at call time (both callers
  // have its id before invoking this), so relatedId threads through as
  // p_related_order_id, letting every inventory_activities row this
  // produces be traced straight back to the order that caused it.
  // Direct POS sale: relatedId is genuinely unavailable here -- the sales
  // row this would reference is only created by the caller AFTER this
  // function returns (it needs totals this function computes) -- so
  // p_related_sale_id stays null; there's nothing to link to yet.
  const rpcParams = isOrderProcessing
    ? { p_items: rpcItems, p_user_id: userId, p_related_order_id: relatedId }
    : { p_items: rpcItems, p_user_id: userId, p_related_sale_id: relatedId };

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
// Every item must resolve to a real variant_id -- when neither variantId
// nor size/color is given, falls back to the product's sole variant (the
// common "simple product" case), same as resolveVariantInfo above.
export async function releaseItemsReservation(items) {
  if (!items || items.length === 0) return;

  const inventoryIds = [...new Set(items.map(i => i.inventoryId))];
  const { data: variantRows } = await supabaseAdmin
    .from('inventory_variants')
    .select('id, inventory_id, size, color')
    .in('inventory_id', inventoryIds)
    .eq('is_active', true);

  const variantByKey = new Map((variantRows || []).map(v => [`${v.inventory_id}|${v.size}|${v.color}`, v]));
  const variantsByInventory = new Map();
  for (const v of variantRows || []) {
    if (!variantsByInventory.has(v.inventory_id)) variantsByInventory.set(v.inventory_id, []);
    variantsByInventory.get(v.inventory_id).push(v);
  }

  const rpcItems = items.map(i => {
    let variantId = i.variant?.variantId || null;
    if (!variantId && i.variant?.size && i.variant?.color) {
      variantId = variantByKey.get(`${i.inventoryId}|${i.variant.size}|${i.variant.color}`)?.id || null;
    }
    if (!variantId) {
      const productVariants = variantsByInventory.get(i.inventoryId) || [];
      if (productVariants.length === 1) variantId = productVariants[0].id;
    }
    if (!variantId) {
      throw new Error(`Could not resolve a variant to release stock for item ${i.inventoryId}`);
    }
    return { variant_id: variantId, quantity: i.quantity };
  });

  const { error } = await supabaseAdmin.rpc('fn_release_stock_reservations_bulk', { p_items: rpcItems });
  if (error) {
    throw new Error(`Failed to release reservations: ${error.message}`);
  }
}
