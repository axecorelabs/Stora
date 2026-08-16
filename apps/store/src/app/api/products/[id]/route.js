import { NextResponse } from "next/server";
import { findInventoryById, findActiveBatchesByInventoryId, resolveBatchPricing, findStoreById } from "@/lib/supabaseStore";

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

    // Get store details
    const store = await findStoreById(product.storeId);

    if (!store) {
      return NextResponse.json(
        { success: false, message: "Store not found" },
        { status: 404 }
      );
    }

    const {
      sellingPrice: currentPrice,
      availableQuantity: totalAvailableQuantity,
      activeBatches,
      currentBatch,
      batchInfo
    } = await resolveBatchPricing(product, batches);

    const priceRange = batchInfo.priceRange || { min: null, max: null };
    const averageSellingPrice = batchInfo.averagePrice;

    // Prepare enhanced product data
    const enhancedProduct = {
      ...product,
      // Override pricing with CURRENT BATCH pricing (FIFO)
      sellingPrice: currentPrice,

      // Override quantity with total available from all batches -- both
      // fields, since consumers are inconsistent about which they read.
      quantityInStock: totalAvailableQuantity,
      availableQuantity: totalAvailableQuantity,

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

      // Batch metadata -- already correctly computed by resolveBatchPricing
      batchInfo,

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
