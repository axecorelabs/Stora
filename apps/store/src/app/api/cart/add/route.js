import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { getOrCreateCart, addItemToCart, prepareCartItemData, enrichCartWithProductData, sanitizeCart } from "@/lib/supabaseCart";

export async function POST(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { productId, quantity = 1, variantId, color, size, notes } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, message: "Product ID is required" },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { success: false, message: "Quantity must be at least 1" },
        { status: 400 }
      );
    }

    // Prepare variant data if provided
    let variantData = null;
    if (variantId && color && size) {
      variantData = {
        variant_id: variantId,
        color,
        size
      };
    }

    // Get or create cart
    let cart = await getOrCreateCart(customerId);

    // Prepare item data with batch pricing
    const itemData = await prepareCartItemData(productId, quantity, variantData, notes);

    // Add item to cart
    cart = await addItemToCart(cart, itemData);
    
    // Enrich with product data
    cart = await enrichCartWithProductData(cart);

    // Log successful addition
    console.log(`Item added to cart with batch pricing:`, {
      productId,
      quantity,
      variant: variantData,
      batchInfo: itemData.batch
    });

    return NextResponse.json({
      success: true,
      cart: sanitizeCart(cart),
      message: variantData 
        ? `${color} - ${size} added to cart successfully`
        : "Item added to cart successfully",
      pricingInfo: itemData.batch ? {
        usingBatchPricing: true,
        batchCode: itemData.batch.batch_code,
        price: itemData.price
      } : {
        usingBatchPricing: false,
        price: itemData.price
      }
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    
    // Handle specific error types
    if (error.message.includes('Product not found') || error.message.includes('Variant not found')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 404 }
      );
    }
    
    if (error.message.includes('not available') || 
        error.message.includes('stock') || 
        error.message.includes('variant selection')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to add item to cart",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
