import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getOrCreateWishlist,
  findWishlistWithItems,
  addItemToWishlist,
  prepareWishlistItemData,
  enrichWishlistWithProductData
} from "@/lib/supabaseWishlist";
import { cacheGet, cacheSet, cacheDel, cacheKey, WISHLIST_CACHE_TTL_SECONDS } from "@/lib/redis";

// GET - Fetch customer's wishlist. Cached per-customer -- every reload of
// the main storefront (and every "is this liked" check across vendor
// pages) hits this, but it only ever changes via the mutations below, all
// of which write the fresh result straight back into the cache. So a GET
// only touches Postgres on a genuinely cold cache (first visit, or the TTL
// backstop expiring), never as a matter of course.
export async function GET(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const key = cacheKey.wishlist(customerId);
    const hit = await cacheGet(key);
    if (hit) {
      return NextResponse.json({ success: true, wishlist: hit });
    }

    let wishlist = await findWishlistWithItems(customerId);

    if (!wishlist) {
      // Create wishlist if it doesn't exist
      const newWishlist = await getOrCreateWishlist(customerId);
      wishlist = { ...newWishlist, items: [] };
    }

    // Enrich with fresh product data
    wishlist = await enrichWishlistWithProductData(wishlist);

    await cacheSet(key, wishlist, WISHLIST_CACHE_TTL_SECONDS);

    return NextResponse.json({
      success: true,
      wishlist
    });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch wishlist" },
      { status: 500 }
    );
  }
}

// POST - Add item to wishlist
export async function POST(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productId, priority = 'medium', notes = '', notifications = {} } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, message: "Product ID is required" },
        { status: 400 }
      );
    }

    // Prepare item data with product and store snapshots
    const itemData = await prepareWishlistItemData(productId, {
      priority,
      notes,
      notifications
    });

    // Add to wishlist -- addItemToWishlist itself returns just the newly
    // inserted item row (see supabaseWishlist.js), not the wishlist+items
    // shape enrichWishlistWithProductData expects, so (like the DELETE/PUT
    // item routes below) re-fetch the full wishlist afterward rather than
    // passing its return value straight through.
    await addItemToWishlist(customerId, itemData);
    const wishlist = await findWishlistWithItems(customerId);

    // Enrich with fresh product data
    const enrichedWishlist = await enrichWishlistWithProductData(wishlist);

    // Write-through: leaves the cache holding this fresh result rather than
    // just invalidating it, so the next GET (e.g. the page re-rendering
    // right after this call) doesn't force an avoidable Postgres round trip.
    await cacheSet(cacheKey.wishlist(customerId), enrichedWishlist, WISHLIST_CACHE_TTL_SECONDS);

    return NextResponse.json({
      success: true,
      message: "Item added to wishlist",
      wishlist: enrichedWishlist
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    
    if (error.message === 'Product already in wishlist') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to add item to wishlist" },
      { status: 500 }
    );
  }
}

// PUT - Update wishlist settings
export async function PUT(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, isPublic } = body;

    const wishlist = await getOrCreateWishlist(customerId);

    // Update wishlist properties using Supabase
    const { data, error } = await supabaseAdmin
      .from('wishlists')
      .update({
        name: name !== undefined ? name : wishlist.name,
        description: description !== undefined ? description : wishlist.description,
        is_public: isPublic !== undefined ? isPublic : wishlist.is_public,
        updated_at: new Date().toISOString()
      })
      .eq('id', wishlist.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Settings (name/description/visibility), not items -- simpler to just
    // invalidate than to reconstruct the enriched items shape here.
    await cacheDel(cacheKey.wishlist(customerId));

    return NextResponse.json({
      success: true,
      message: "Wishlist updated successfully",
      wishlist: data
    });
  } catch (error) {
    console.error("Error updating wishlist:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update wishlist" },
      { status: 500 }
    );
  }
}
