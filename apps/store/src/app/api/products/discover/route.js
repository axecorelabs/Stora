import { NextResponse } from "next/server";
import { findDiscoverableProducts } from "@/lib/supabaseStore";
import { cached, cacheKey } from "@/lib/redis";

// Public, unauthenticated -- backs the homepage's discovery grid (and its
// category chips / search box, which just re-call this with different query
// params rather than needing a separate results page). Cached per unique
// (category, search, sort, limit) combo -- the no-filter/default-sort combo
// every homepage load starts on gets the most benefit, free-text search
// combos just cache themselves the first time each one is typed.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search")?.trim() || undefined;
    const sortParam = searchParams.get("sort");
    const sort = sortParam === "new" ? "new" : "trending";
    const limitParam = parseInt(searchParams.get("limit"), 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 24) : 12;

    const products = await cached(
      cacheKey.discover(category, search, sort, limit),
      180,
      () => findDiscoverableProducts({ category, search, sort, limit })
    );

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("Error fetching discoverable products:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
