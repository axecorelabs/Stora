import { NextResponse } from "next/server";
import { searchVendorsPaginated, searchProductsPaginated } from "@/lib/supabaseStore";
import { cached, cacheKey } from "@/lib/redis";

const VENDOR_PREVIEW_LIMIT = 3;
const PRODUCT_PREVIEW_LIMIT = 4;
const PREVIEW_CACHE_TTL_SECONDS = 60;

// Public, unauthenticated -- backs the search bar's instant-preview
// dropdown (components/search/SearchTypeahead.js). One request per
// keystroke (debounced client-side) instead of two, and capped small
// limits since this is a preview, not the results page -- the dropdown's
// own "See all results" link is what hands off to /products or /vendors
// for the real paginated view. Short-TTL cached on `q` alone (unlike full
// search, which has too wide a parameter space to cache usefully) --
// common short prefixes get typed identically by many different people, so
// this one has a real hit rate. Rate-limited via proxy.js's browseLimiter
// (public API matcher includes /api/search/:path*).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json({ success: true, vendors: [], products: [] });
    }

    const result = await cached(cacheKey.searchPreview(q), PREVIEW_CACHE_TTL_SECONDS, async () => {
      const [vendorsResult, productsResult] = await Promise.all([
        searchVendorsPaginated({ search: q, limit: VENDOR_PREVIEW_LIMIT, offset: 0 }),
        searchProductsPaginated({ search: q, limit: PRODUCT_PREVIEW_LIMIT, offset: 0 })
      ]);

      return {
        vendors: vendorsResult.vendors,
        vendorTotal: vendorsResult.totalCount,
        products: productsResult.products,
        productTotal: productsResult.totalCount
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error fetching search preview:", error);
    return NextResponse.json(
      { success: false, message: "Failed to search" },
      { status: 500 }
    );
  }
}
