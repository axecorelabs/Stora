import { NextResponse } from "next/server";
import { extractSearchIntent, embedText } from "@/lib/openrouter";
import {
  searchProductsByEmbedding,
  searchVendorsByEmbedding,
  searchProductsPaginated,
  searchVendorsPaginated
} from "@/lib/supabaseStore";
import { cached, cacheKey } from "@/lib/redis";

const PAGE_SIZE = 24;
// The *other* result type (vendors on /products, products on /vendors) is
// a small supplementary strip, not a paginated grid -- always this many,
// regardless of `page`.
const SECONDARY_LIMIT = 6;
// Cost/abuse control -- capped well before it ever reaches OpenRouter, not
// just for token cost but to shrink the prompt-injection surface (a
// customer's query is DATA passed to the extraction model, never
// instructions it follows -- see openrouter.js's system prompt -- but a
// hard length cap is a cheap second layer regardless).
const MAX_QUERY_LENGTH = 300;
// Long TTL: a given phrase's meaning doesn't drift, and many different
// customers type near-identical natural-language queries.
const AI_SEARCH_CACHE_TTL_SECONDS = 60 * 60 * 24;

async function resolveQueryUnderstanding(query) {
  const [intent, embedding] = await Promise.all([
    extractSearchIntent(query),
    embedText(query)
  ]);
  // Both steps have to succeed -- a filter with no embedding to rank by, or
  // an embedding with no filters, isn't useful on its own. Either failing
  // means the caller falls back to plain keyword search instead.
  if (!intent || !embedding) return null;
  return { intent, embedding };
}

// Public, unauthenticated -- the natural-language ("I'm looking for a
// vendor that sells X") entry point, additive to the existing keyword
// search (/api/products/search, /api/vendors/search, SearchTypeahead's
// preview). Never errors out to the customer: any failure in the
// extraction/embedding steps below falls back to a plain keyword search on
// the raw query, so this endpoint always returns real results.
//
// `primary` (products|vendors) picks which result type gets real pagination
// (`page`/`pagination` in the response) -- the /products page pages
// through products and shows a small fixed-size vendor strip alongside,
// /vendors does the reverse. Both result arrays are always present in the
// response either way; only which one is paginated changes.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("q")?.trim() || "";
    // The vendor's own operating state -- independent of buyerState/
    // deliverableOnly below (that's the *customer's* address, used for the
    // hard "only vendors that deliver to me" filter). This one narrows to
    // vendors physically based in a given state, same as the keyword
    // search's `state` param already does.
    const state = searchParams.get("state") || undefined;
    const buyerState = searchParams.get("buyerState") || undefined;
    const deliverableOnly = searchParams.get("deliverableOnly") === "true" && !!buyerState;
    const primary = searchParams.get("primary") === "vendors" ? "vendors" : "products";
    const pageParam = parseInt(searchParams.get("page"), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const offset = (page - 1) * PAGE_SIZE;

    if (!rawQuery) {
      return NextResponse.json(
        { success: false, message: "A search query is required" },
        { status: 400 }
      );
    }

    const query = rawQuery.slice(0, MAX_QUERY_LENGTH);

    const understanding = await cached(
      cacheKey.aiSearch(query),
      AI_SEARCH_CACHE_TTL_SECONDS,
      () => resolveQueryUnderstanding(query)
    );

    let products, productTotal, vendors, vendorTotal, mode;

    if (understanding) {
      mode = "ai";
      const { intent, embedding } = understanding;
      const categories = intent.category ? [intent.category] : undefined;
      const productOffset = primary === "products" ? offset : 0;
      const productLimit = primary === "products" ? PAGE_SIZE : SECONDARY_LIMIT;
      const vendorOffset = primary === "vendors" ? offset : 0;
      const vendorLimit = primary === "vendors" ? PAGE_SIZE : SECONDARY_LIMIT;

      const [productResult, vendorResult] = await Promise.all([
        searchProductsByEmbedding({
          embedding,
          categories,
          minPrice: intent.priceMin ?? undefined,
          maxPrice: intent.priceMax ?? undefined,
          state,
          buyerState,
          deliverableOnly,
          limit: productLimit,
          offset: productOffset
        }),
        searchVendorsByEmbedding({
          embedding,
          categories,
          state,
          buyerState,
          deliverableOnly,
          limit: vendorLimit,
          offset: vendorOffset
        })
      ]);
      ({ products, totalCount: productTotal } = productResult);
      ({ vendors, totalCount: vendorTotal } = vendorResult);

      // Category is freeform text at the DB level -- vendors can and do
      // file items under values outside the fixed taxonomy the extraction
      // model chooses from (e.g. a "wig" product filed as "Other" when the
      // model guesses "Clothing"). A hard category filter doesn't just
      // return nothing in that case -- pgvector happily fills the page with
      // the nearest neighbors that DO match the (wrong) category, silently
      // crowding out the real match instead of just ranking it lower. Only
      // worth correcting on the first page, where there's still room left
      // in it: backfill with the top uncategorized matches, deduped against
      // what's already there.
      //
      // Vendors don't get this treatment: search_vendors_ai's category
      // filter means "does this vendor actually stock that category" (an
      // EXISTS check against their real inventory) -- a deliberate, correct
      // narrowing, not an artifact of freeform category strings like the
      // product filter above. Backfilling there would undo the fix for the
      // "vendor that sells books" case (surfacing vendors with no relation
      // to the query) to chase a problem this filter doesn't actually have.
      if (categories && productOffset === 0 && productTotal < productLimit) {
        const excludeIds = new Set(products.map((p) => p.id));
        const backfill = await searchProductsByEmbedding({
          embedding,
          minPrice: intent.priceMin ?? undefined,
          maxPrice: intent.priceMax ?? undefined,
          state,
          buyerState,
          deliverableOnly,
          limit: productLimit,
          offset: 0
        });
        products = [...products, ...backfill.products.filter((p) => !excludeIds.has(p.id))].slice(0, productLimit);
        productTotal = Math.max(productTotal, products.length);
      }
    } else {
      // Fallback: extraction or embedding failed (bad/missing API key,
      // provider timeout, invalid model output) -- degrade to the same
      // plain keyword search /api/products/search and /api/vendors/search
      // already use, rather than surfacing an error for something the
      // customer has no way to fix.
      mode = "keyword-fallback";
      const [productResult, vendorResult] = await Promise.all([
        searchProductsPaginated({
          search: query,
          state,
          buyerState,
          deliverableOnly,
          limit: primary === "products" ? PAGE_SIZE : SECONDARY_LIMIT,
          offset: primary === "products" ? offset : 0
        }),
        searchVendorsPaginated({
          search: query,
          state,
          buyerState,
          deliverableOnly,
          limit: primary === "vendors" ? PAGE_SIZE : SECONDARY_LIMIT,
          offset: primary === "vendors" ? offset : 0
        })
      ]);
      ({ products, totalCount: productTotal } = productResult);
      ({ vendors, totalCount: vendorTotal } = vendorResult);
    }

    const primaryTotal = primary === "products" ? productTotal : vendorTotal;

    return NextResponse.json({
      success: true,
      mode,
      query: rawQuery,
      interpretedAs: understanding?.intent || null,
      products,
      productTotal,
      vendors,
      vendorTotal,
      pagination: {
        page,
        limit: PAGE_SIZE,
        total: primaryTotal,
        totalPages: Math.max(1, Math.ceil(primaryTotal / PAGE_SIZE)),
        hasMore: page * PAGE_SIZE < primaryTotal
      }
    });
  } catch (error) {
    console.error("Error in AI search:", error);
    return NextResponse.json(
      { success: false, message: "Failed to search" },
      { status: 500 }
    );
  }
}
