import { NextResponse } from "next/server";
import { searchVendorsPaginated } from "@/lib/supabaseStore";

const PAGE_SIZE = 24;

// Public, unauthenticated -- backs the dedicated /vendors search & browse
// page. Distinct from /api/stores/featured (small, cached homepage
// teaser); this one is built for real pagination across the full vendor
// directory, see searchVendorsPaginated.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() || undefined;
    const categories = searchParams.get("category")?.split(",").filter(Boolean) || undefined;
    const state = searchParams.get("state") || undefined;
    const buyerState = searchParams.get("buyerState") || undefined;
    const deliverableOnly = searchParams.get("deliverableOnly") === "true" && !!buyerState;
    const sortParam = searchParams.get("sort");
    const sortRequested = ["featured", "newest", "name", "nearest"].includes(sortParam) ? sortParam : "featured";
    // "nearest" with no buyer state to sort against is inert at the DB
    // layer (it degrades to the default ordering) -- fall back explicitly
    // here rather than forwarding a sort mode that can't do anything.
    const sort = sortRequested === "nearest" && !buyerState ? "featured" : sortRequested;
    const pageParam = parseInt(searchParams.get("page"), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const { vendors, totalCount } = await searchVendorsPaginated({
      search,
      categories,
      state,
      buyerState,
      deliverableOnly,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    });

    return NextResponse.json({
      success: true,
      vendors,
      pagination: {
        page,
        limit: PAGE_SIZE,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
        hasMore: page * PAGE_SIZE < totalCount
      }
    });
  } catch (error) {
    console.error("Error searching vendors:", error);
    return NextResponse.json(
      { success: false, message: "Failed to search vendors" },
      { status: 500 }
    );
  }
}
