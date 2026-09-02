import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { getOrCreateCart, enrichCartWithProductData, clearCart, addItemToCart, prepareCartItemData, sanitizeCart } from "@/lib/supabaseCart";
import { resolveCampaignAttribution } from "@/lib/campaignAttribution";

// GET - Get customer's cart
export async function GET(request) {
  try {
    let customerId;
    try {
      customerId = await verifyCustomerSession(request);
    } catch (sessionError) {
      console.warn('Session verification failed:', sessionError.message);
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    // Get or create cart
    let cart = await getOrCreateCart(customerId);
    
    // Enrich cart with current product data
    const attributionByStoreId = await resolveCampaignAttribution(request);
    cart = await enrichCartWithProductData(cart, attributionByStoreId);

    return NextResponse.json({
      success: true,
      cart: sanitizeCart(cart)
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch cart",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Clear cart
export async function DELETE(request) {
  try {
    const customerId = await verifyCustomerSession(request);

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const cart = await getOrCreateCart(customerId);
    await clearCart(cart);

    return NextResponse.json({
      success: true,
      message: "Cart cleared successfully"
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    return NextResponse.json(
      { success: false, message: "Failed to clear cart" },
      { status: 500 }
    );
  }
}

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
    
    // Enrich and return
    const attributionByStoreId = await resolveCampaignAttribution(request);
    cart = await enrichCartWithProductData(cart, attributionByStoreId);

    return NextResponse.json({
      success: true,
      cart: sanitizeCart(cart),
      message: variantData
        ? `${color} - ${size} added to cart successfully`
        : "Item added to cart successfully"
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Failed to add item to cart",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
