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

    const stores = await cached(cacheKey.featuredStores(limit), 300, async () => {
      const found = await findFeaturedStores({ limit });
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
