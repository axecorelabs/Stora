import { NextResponse } from "next/server";
import { findFeaturedStores, buildPublicStoreData } from "@/lib/supabaseStore";
import { cached, cacheKey } from "@/lib/redis";

// Public, unauthenticated -- backs the homepage's vendor showcase. Every
// visitor loading the homepage hits this with the same handful of `limit`
// values, so a short shared cache turns "N concurrent homepage loads" into
// roughly one Postgres query every few minutes instead of N.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get("limit"), 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 24) : 12;
    // Same cookie DeliveryStateContext.js maintains client-side (an
    // explicit pick, a signed-in customer's saved preference, or
    // proxy.js's own IP-geo guess as a last resort) -- read directly here
    // rather than requiring the client to pass it, so this route ranks by
    // proximity even on a visitor's very first request.
    const buyerState = request.cookies.get("stora_deliver_state")?.value || null;

    const stores = await cached(`${cacheKey.featuredStores(limit, buyerState)}:visibility-v2`, 300, async () => {
      const found = await findFeaturedStores({ limit, buyerState });
      return found.map(buildPublicStoreData);
    });

    return NextResponse.json({
      success: true,
      stores,
    });
  } catch (error) {
    console.error("Error fetching featured stores:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch featured stores" },
      { status: 500 }
    );
  }
}
