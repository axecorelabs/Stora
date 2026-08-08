import { NextResponse } from "next/server";
import { findInventoryById, findActiveBatchesByInventoryId, calculateBatchQuantities, findStoreById } from "@/lib/supabaseStore";

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Fetch product using Supabase
    const product = await findInventoryById(id);

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    // Check if product is active (equivalent to webVisibility)
    if (!product.isActive) {
      return NextResponse.json(
        { success: false, message: "Product not available" },
        { status: 404 }
      );
    }

    // Get ALL batches for this product, sorted by FIFO (dateReceived ascending)
    const batches = await findActiveBatchesByInventoryId(id);
    const batchesWithQuantities = await calculateBatchQuantities(batches);

    // Filter to ONLY batches that have stock
    const activeBatches = batchesWithQuantities.filter(batch => batch.actualQuantityRemaining > 0);

    // Find the current active batch using FIFO logic (first batch with stock)
    const currentActiveBatch = activeBatches.length > 0 ? activeBatches[0] : null;

    // Get store details
    const store = await findStoreById(product.storeId);

    if (!store) {
      return NextResponse.json(
        { success: false, message: "Store not found" },
        { status: 404 }
      );
    }

    // Calculate batch-based pricing and availability
    let currentPrice = product.sellingPrice; // fallback
    let currentCostPrice = product.costPrice; // fallback
    let totalAvailableQuantity = 0;
    let priceRange = { min: null, max: null };
    let hasBatches = activeBatches.length > 0;
    let currentBatch = null;

    if (currentActiveBatch) {
      // Use the FIRST batch with stock (FIFO) for current pricing
      currentBatch = currentActiveBatch;
      currentPrice = currentActiveBatch.selling_price;
      currentCostPrice = currentActiveBatch.cost_price;
      
      // Calculate total available quantity from all batches with stock
      totalAvailableQuantity = activeBatches.reduce((sum, batch) => sum + batch.actualQuantityRemaining, 0);
      
      // Calculate price range across all active batches
      const prices = activeBatches.map(batch => batch.selling_price);
      priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices)
      };
    } else {
      // No active batches with stock, use inventory stock if batch system not in use
      totalAvailableQuantity = product.quantityInStock || 0;
    }

    // Calculate weighted averages across all batches (for reference)
    const totalQuantityIn = batchesWithQuantities.reduce((sum, batch) => sum + (batch.quantity_in || 0), 0);
    const weightedSellingSum = batchesWithQuantities.reduce((sum, batch) => 
      sum + ((batch.selling_price || 0) * (batch.quantity_in || 0)), 0
    );
    const averageSellingPrice = totalQuantityIn > 0 ? weightedSellingSum / totalQuantityIn : currentPrice;

    // Prepare enhanced product data
    const enhancedProduct = {
      ...product,
      // Override pricing with CURRENT BATCH pricing (FIFO)
      sellingPrice: currentPrice,
      
      // Override quantity with total available from all batches
      quantityInStock: totalAvailableQuantity,
      
      // Batch information - only include batches with actual stock
      batches: activeBatches.map(batch => ({
        id: batch.id,
        batchCode: batch.batch_code,
        quantityIn: batch.quantity_in,
        quantitySold: batch.quantity_sold,
        quantityRemaining: batch.actualQuantityRemaining,
        sellingPrice: batch.selling_price,
        dateReceived: batch.date_received,
        expiryDate: batch.expiry_date,
        supplier: batch.supplier,
        isExpired: batch.expiry_date ? new Date() > new Date(batch.expiry_date) : false,
        daysUntilExpiry: batch.expiry_date ? Math.ceil((new Date(batch.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : null,
        isCurrentBatch: currentBatch ? batch.id === currentBatch.id : false
      })),
      
      // Batch metadata
      batchInfo: {
        hasBatches: hasBatches,
        totalBatches: activeBatches.length,
        totalAvailableQuantity,
        currentBatchId: currentBatch?.id,
        currentBatchCode: currentBatch?.batch_code,
        currentBatchRemaining: currentBatch ? currentBatch.actualQuantityRemaining : 0,
        priceRange: activeBatches.length > 0 ? priceRange : null,
        oldestBatchDate: activeBatches.length > 0 ? activeBatches[0]?.date_received : null,
        newestBatchDate: activeBatches.length > 0 ? activeBatches[activeBatches.length - 1]?.date_received : null,
        averagePrice: averageSellingPrice,
        methodology: 'FIFO - First In, First Out (oldest batches sold first)'
      },
      
      // Pricing information
      pricing: {
        current: currentPrice, // Current selling price from FIFO batch
        average: averageSellingPrice, // Weighted average across all batches
        hasVariablePricing: priceRange && priceRange.min !== priceRange.max,
        range: priceRange
      },
      
      // Remove sensitive pricing from client response
      costPrice: undefined
    };

    return NextResponse.json({
      success: true,
      product: enhancedProduct,
      store,
      batchInfo: {
        note: 'Pricing reflects current active batch using FIFO methodology',
        methodology: 'First In, First Out (FIFO) - oldest batches are sold first',
        currentBatch: currentBatch ? {
          batchCode: currentBatch.batch_code,
          remaining: currentBatch.actualQuantityRemaining,
          price: currentPrice,
          dateReceived: currentBatch.date_received
        } : null
      }
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
