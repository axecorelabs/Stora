import crypto from 'crypto';
import { supabaseAdmin } from './supabase';

// Process one line item against inventory/variant/batch records using FIFO.
// isOrderProcessing=true means stock was already reserved earlier (at order
// creation) and this call is *fulfilling* that reservation: skip the
// available-stock check, release the reservation, and deduct real stock.
// isOrderProcessing=false is a regular POS sale: check stock, deduct directly
// (no reservation involved).
export async function processItemWithBatchTracking(saleItem, userId, isOrderProcessing = false) {
  const { data: inventoryItem, error: invError } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .eq('id', saleItem.inventoryId)
    .single();

  if (invError || !inventoryItem) {
    throw new Error(`Inventory item not found: ${saleItem.inventoryId}`);
  }

  let variantInfo = null;
  let selectedVariant = null;

  if (saleItem.variant && saleItem.variant.size && saleItem.variant.color) {
    const { data: variant } = await supabaseAdmin
      .from('inventory_variants')
      .select('*')
      .eq('inventory_id', saleItem.inventoryId)
      .eq('size', saleItem.variant.size)
      .eq('color', saleItem.variant.color)
      .eq('is_active', true)
      .single();

    if (!variant) {
      throw new Error(`Variant ${saleItem.variant.color} - ${saleItem.variant.size} not found for ${inventoryItem.name}`);
    }

    selectedVariant = variant;

    if (!isOrderProcessing && variant.quantity_in_stock < saleItem.quantity) {
      throw new Error(`Insufficient stock for variant ${saleItem.variant.color} - ${saleItem.variant.size}. Available: ${variant.quantity_in_stock}, Requested: ${saleItem.quantity}`);
    }

    variantInfo = {
      hasVariant: true,
      size: saleItem.variant.size,
      color: saleItem.variant.color,
      variantSku: variant.sku,
      variantId: variant.id,
      images: variant.images || []
    };
  } else {
    if (!isOrderProcessing && inventoryItem.stock_quantity < saleItem.quantity) {
      throw new Error(`Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.stock_quantity}, Requested: ${saleItem.quantity}`);
    }

    variantInfo = {
      hasVariant: false,
      size: null,
      color: null,
      variantSku: null,
      variantId: null,
      images: []
    };
  }

  // Get available batches - FIFO order
  let batchQuery = supabaseAdmin
    .from('inventory_batches')
    .select('*')
    .eq('inventory_id', saleItem.inventoryId)
    .gt('quantity_remaining', 0)
    .order('created_at', { ascending: true }); // FIFO

  if (variantInfo.hasVariant) {
    batchQuery = batchQuery.eq('variant_id', variantInfo.variantId);
  }

  const { data: availableBatches } = await batchQuery;

  let totalCost = 0;
  let totalProfit = 0;
  let batchesUsed = 0;
  const batchesSoldFrom = [];

  if (availableBatches && availableBatches.length > 0) {
    let remainingQuantity = saleItem.quantity;

    for (const batch of availableBatches) {
      if (remainingQuantity <= 0) break;

      const quantityFromThisBatch = Math.min(remainingQuantity, batch.quantity_remaining);
      const costPriceFromBatch = parseFloat(batch.cost_price || inventoryItem.cost || 0);

      const newQuantitySold = (batch.quantity_sold || 0) + quantityFromThisBatch;
      const newQuantityRemaining = batch.quantity_remaining - quantityFromThisBatch;
      const newQuantityReserved = isOrderProcessing
        ? Math.max(0, (batch.quantity_reserved || 0) - quantityFromThisBatch)
        : (batch.quantity_reserved || 0);

      let newStatus = batch.status;
      if (newQuantityRemaining <= 0) {
        newStatus = 'depleted';
      } else if (batch.expiry_date && new Date(batch.expiry_date) < new Date()) {
        newStatus = 'expired';
      }

      const { error: batchUpdateError } = await supabaseAdmin
        .from('inventory_batches')
        .update({
          quantity_sold: newQuantitySold,
          quantity_remaining: newQuantityRemaining,
          quantity_reserved: newQuantityReserved,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', batch.id);

      if (batchUpdateError) {
        throw new Error(`Failed to update batch ${batch.batch_code}: ${batchUpdateError.message}`);
      }

      batchesSoldFrom.push({
        batchId: batch.id,
        batchCode: batch.batch_code,
        quantityFromBatch: quantityFromThisBatch,
        costPriceFromBatch: costPriceFromBatch,
        batchVariant: variantInfo.hasVariant ? {
          size: variantInfo.size,
          color: variantInfo.color,
          variantSku: variantInfo.variantSku
        } : null
      });

      const costFromThisBatch = quantityFromThisBatch * costPriceFromBatch;
      const profitFromThisBatch = quantityFromThisBatch * (saleItem.unitPrice - costPriceFromBatch);

      totalCost += costFromThisBatch;
      totalProfit += profitFromThisBatch;
      batchesUsed++;
      remainingQuantity -= quantityFromThisBatch;
    }

    if (remainingQuantity > 0) {
      const fallbackCostPrice = parseFloat(inventoryItem.cost || 0);
      const fallbackCost = remainingQuantity * fallbackCostPrice;
      const fallbackProfit = remainingQuantity * (saleItem.unitPrice - fallbackCostPrice);
      totalCost += fallbackCost;
      totalProfit += fallbackProfit;
      console.warn(`Used fallback pricing for ${remainingQuantity} units of ${inventoryItem.name}`);
    }
  } else {
    const costPrice = parseFloat(inventoryItem.cost || 0);
    totalCost = saleItem.quantity * costPrice;
    totalProfit = saleItem.quantity * (saleItem.unitPrice - costPrice);
    console.warn(`No batches found for ${inventoryItem.name}, using inventory cost price`);
  }

  // Update inventory quantities
  let stockUpdateError;
  let previousStock;
  let newStockLevel;
  if (variantInfo.hasVariant && selectedVariant) {
    const newSoldQuantity = (selectedVariant.sold_quantity || 0) + saleItem.quantity;
    previousStock = selectedVariant.quantity_in_stock;

    if (isOrderProcessing) {
      const newReservedQuantity = Math.max(0, (selectedVariant.reserved_quantity || 0) - saleItem.quantity);
      newStockLevel = selectedVariant.quantity_in_stock - saleItem.quantity;

      ({ error: stockUpdateError } = await supabaseAdmin
        .from('inventory_variants')
        .update({
          quantity_in_stock: newStockLevel,
          reserved_quantity: newReservedQuantity,
          sold_quantity: newSoldQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedVariant.id));
    } else {
      newStockLevel = selectedVariant.quantity_in_stock - saleItem.quantity;

      ({ error: stockUpdateError } = await supabaseAdmin
        .from('inventory_variants')
        .update({
          quantity_in_stock: newStockLevel,
          sold_quantity: newSoldQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedVariant.id));
    }
  } else {
    const newSoldQuantity = (inventoryItem.sold_quantity || 0) + saleItem.quantity;
    previousStock = inventoryItem.stock_quantity;

    if (isOrderProcessing) {
      const newReservedQuantity = Math.max(0, (inventoryItem.quantity_reserved || 0) - saleItem.quantity);
      newStockLevel = inventoryItem.stock_quantity - saleItem.quantity;

      ({ error: stockUpdateError } = await supabaseAdmin
        .from('inventory')
        .update({
          stock_quantity: newStockLevel,
          quantity_reserved: newReservedQuantity,
          sold_quantity: newSoldQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryItem.id));
    } else {
      newStockLevel = inventoryItem.stock_quantity - saleItem.quantity;

      ({ error: stockUpdateError } = await supabaseAdmin
        .from('inventory')
        .update({
          stock_quantity: newStockLevel,
          sold_quantity: newSoldQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryItem.id));
    }
  }

  if (stockUpdateError) {
    throw new Error(`Failed to update stock for ${inventoryItem.name}: ${stockUpdateError.message}`);
  }

  // Create inventory activity record (non-fatal if it fails)
  const { error: activityError } = await supabaseAdmin
    .from('inventory_activities')
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      inventory_id: saleItem.inventoryId,
      activity_type: 'stock_removed',
      quantity_before: previousStock,
      quantity_changed: saleItem.quantity,
      quantity_after: newStockLevel,
      reason: variantInfo.hasVariant
        ? `Sold: ${saleItem.quantity} ${inventoryItem.unit_of_measure || 'unit'} (${variantInfo.color} - ${variantInfo.size}) via ${isOrderProcessing ? 'order fulfillment' : 'POS'}`
        : `Sold: ${saleItem.quantity} ${inventoryItem.unit_of_measure || 'unit'} via ${isOrderProcessing ? 'order fulfillment' : 'POS'}`,
      metadata: {
        saleType: isOrderProcessing ? 'order' : 'pos',
        hasVariant: variantInfo.hasVariant,
        variant: variantInfo.hasVariant ? {
          size: variantInfo.size,
          color: variantInfo.color,
          sku: variantInfo.variantSku
        } : null,
        batchesUsed: batchesSoldFrom.map(b => ({
          batchCode: b.batchCode,
          quantity: b.quantityFromBatch
        }))
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (activityError) {
    console.error('Inventory activity log error (non-fatal):', activityError);
  }

  const processedItem = {
    inventoryId: saleItem.inventoryId,
    productName: saleItem.productName || inventoryItem.name,
    sku: saleItem.sku || inventoryItem.sku,
    quantity: saleItem.quantity,
    unitPrice: saleItem.unitPrice,
    total: saleItem.total,
    variant: variantInfo,
    batchesSoldFrom: batchesSoldFrom,
    costBreakdown: {
      totalCost: totalCost,
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
    batchesUsed,
    totalCost,
    totalProfit
  };
}

// Release a previously-reserved quantity (e.g. order cancelled before
// fulfillment) without deducting stock or recording a sale -- FIFO across
// batches' quantity_reserved, mirroring how the reservation was made.
export async function releaseItemReservation(inventoryId, quantity, variant = null) {
  if (variant && variant.size && variant.color) {
    const { data: variantRow } = await supabaseAdmin
      .from('inventory_variants')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('size', variant.size)
      .eq('color', variant.color)
      .single();

    if (variantRow) {
      await supabaseAdmin
        .from('inventory_variants')
        .update({
          reserved_quantity: Math.max(0, (variantRow.reserved_quantity || 0) - quantity),
          updated_at: new Date().toISOString()
        })
        .eq('id', variantRow.id);
    }
  } else {
    const { data: inventoryItem } = await supabaseAdmin
      .from('inventory')
      .select('quantity_reserved')
      .eq('id', inventoryId)
      .single();

    if (inventoryItem) {
      await supabaseAdmin
        .from('inventory')
        .update({
          quantity_reserved: Math.max(0, (inventoryItem.quantity_reserved || 0) - quantity),
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryId);
    }
  }

  // Release from batches, FIFO, oldest reservation first
  const batchFilter = variant?.variantId ? { variant_id: variant.variantId } : {};
  const { data: batches } = await supabaseAdmin
    .from('inventory_batches')
    .select('*')
    .eq('inventory_id', inventoryId)
    .match(batchFilter)
    .gt('quantity_reserved', 0)
    .order('created_at', { ascending: true });

  let remaining = quantity;
  for (const batch of batches || []) {
    if (remaining <= 0) break;
    const releaseFromBatch = Math.min(remaining, batch.quantity_reserved);

    await supabaseAdmin
      .from('inventory_batches')
      .update({
        quantity_reserved: (batch.quantity_reserved || 0) - releaseFromBatch,
        updated_at: new Date().toISOString()
      })
      .eq('id', batch.id);

    remaining -= releaseFromBatch;
  }
}
