import crypto from 'crypto';
import { supabaseAdmin } from './supabase';

// Resolve a {size, color} pair to the real inventory_variants row. This is
// identity resolution (which row are we talking about), not a quantity
// read, so it isn't part of the stock-mutation race and doesn't need to go
// through the atomic RPCs below.
async function resolveVariant(inventoryId, variant) {
  if (!variant || !variant.size || !variant.color) return null;

  const { data } = await supabaseAdmin
    .from('inventory_variants')
    .select('id, sku, images')
    .eq('inventory_id', inventoryId)
    .eq('size', variant.size)
    .eq('color', variant.color)
    .eq('is_active', true)
    .single();

  return data || null;
}

// Process one line item against inventory/variant/batch records. All actual
// quantity mutation happens atomically in Postgres via fn_fulfill_stock_reservation
// (isOrderProcessing=true: converts a reservation made at checkout into a
// real sale) or fn_sell_stock_direct (isOrderProcessing=false: a POS sale
// with no prior reservation) -- see
// apps/dashboard/supabase/migrations/20260814000001_stock_reservation_functions.sql.
// This function's job is just to resolve variant identity, call the right
// RPC, and shape the result into what callers (sale_items rows, receipts,
// cost/profit reporting) expect -- the same shape it always returned.
export async function processItemWithBatchTracking(saleItem, userId, isOrderProcessing = false) {
  const { data: inventoryItem, error: invError } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .eq('id', saleItem.inventoryId)
    .single();

  if (invError || !inventoryItem) {
    throw new Error(`Inventory item not found: ${saleItem.inventoryId}`);
  }

  const requestedVariant = saleItem.variant && saleItem.variant.size && saleItem.variant.color ? saleItem.variant : null;
  const resolvedVariant = await resolveVariant(saleItem.inventoryId, requestedVariant);

  if (requestedVariant && !resolvedVariant) {
    throw new Error(`Variant ${requestedVariant.color} - ${requestedVariant.size} not found for ${inventoryItem.name}`);
  }

  const variantInfo = resolvedVariant
    ? {
        hasVariant: true,
        size: requestedVariant.size,
        color: requestedVariant.color,
        variantSku: resolvedVariant.sku,
        variantId: resolvedVariant.id,
        images: resolvedVariant.images || []
      }
    : { hasVariant: false, size: null, color: null, variantSku: null, variantId: null, images: [] };

  const reasonSuffix = variantInfo.hasVariant
    ? `(${variantInfo.color} - ${variantInfo.size}) via ${isOrderProcessing ? 'order fulfillment' : 'POS'}`
    : `via ${isOrderProcessing ? 'order fulfillment' : 'POS'}`;
  const reason = `Sold: ${saleItem.quantity} ${inventoryItem.unit_of_measure || 'unit'} ${reasonSuffix}`;

  const { data, error } = isOrderProcessing
    ? await supabaseAdmin.rpc('fn_fulfill_stock_reservation', {
        p_inventory_id: saleItem.inventoryId,
        p_variant_id: variantInfo.variantId,
        p_quantity: saleItem.quantity,
        p_user_id: userId,
        p_reason: reason,
        p_related_order_id: null
      })
    : await supabaseAdmin.rpc('fn_sell_stock_direct', {
        p_inventory_id: saleItem.inventoryId,
        p_variant_id: variantInfo.variantId,
        p_quantity: saleItem.quantity,
        p_user_id: userId,
        p_reason: reason,
        p_related_sale_id: null
      });

  if (error) {
    throw new Error(`Failed to process stock for ${inventoryItem.name}: ${error.message}`);
  }

  const result = data?.[0];
  if (!result?.success) {
    throw new Error(`Insufficient stock for ${inventoryItem.name}. Requested: ${saleItem.quantity}`);
  }

  const rpcBatches = result.batches || [];
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

  return {
    processedItem,
    saleItemData,
    batchesUsed: rpcBatches.length,
    totalCost,
    totalProfit
  };
}

// Release a previously-reserved quantity (e.g. order cancelled before
// fulfillment) without deducting stock or recording a sale.
export async function releaseItemReservation(inventoryId, quantity, variant = null) {
  let variantId = variant?.variantId || null;

  if (!variantId && variant?.size && variant?.color) {
    const resolved = await resolveVariant(inventoryId, variant);
    variantId = resolved?.id || null;
  }

  const { error } = await supabaseAdmin.rpc('fn_release_stock_reservation', {
    p_inventory_id: inventoryId,
    p_variant_id: variantId,
    p_quantity: quantity
  });

  if (error) {
    throw new Error(`Failed to release reservation: ${error.message}`);
  }
}
