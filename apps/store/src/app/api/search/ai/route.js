import { NextResponse } from "next/server";
import { extractSearchIntent, embedText } from "@/lib/openrouter";
import {
  searchProductsByEmbedding,
  searchVendorsByEmbedding,
  searchProductsPaginated,
  searchVendorsPaginated,
  searchBiteraveProductsByEmbedding,
  searchBiteraveVendorsByEmbedding,
  searchBiteraveProducts,
  searchBiteraveVendors
} from "@/lib/supabaseStore";
import { supabaseAdmin } from "@/lib/supabase";
import { cached, cacheKey } from "@/lib/redis";
import { NIGERIAN_STATES } from "@stora/shared-constants";

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

const BUSINESS_INTENT_TERMS = new Set([
  "service", "services", "vendor", "vendors", "business", "businesses", "provider", "providers", "hire", "book",
  "photographer", "photography", "plumber", "electrician", "tailor", "stylist", "makeup", "salon", "barber",
  "cleaner", "cleaning", "mechanic", "repair", "decorator", "caterer", "dj", "videographer", "laundry"
]);
const SERVICE_INTENT_TERMS = new Set([
  "photographer", "photography", "videographer", "videography", "plumber", "electrician", "tailor", "stylist",
  "makeup", "salon", "barber", "cleaner", "cleaning", "mechanic", "repair", "decorator", "caterer", "dj",
  "laundry", "service", "services", "provider", "providers", "hire", "book"
]);
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "i", "i'm", "im", "in", "into", "is", "it",
  "looking", "look", "me", "my", "need", "of", "on", "or", "please", "shop", "some", "that", "the", "to", "want", "with", "you"
]);
const STATE_VALUES = NIGERIAN_STATES.map((s) => s.value);
const STATE_VALUES_LOWER = new Map(STATE_VALUES.map((state) => [state.toLowerCase(), state]));
const CITY_TO_STATE = new Map([
  ["osogbo", "Osun"],
  ["ilesa", "Osun"],
  ["ife", "Osun"],
  ["ilorin", "Kwara"],
  ["ibadan", "Oyo"],
  ["abeokuta", "Ogun"],
  ["ikeja", "Lagos"],
  ["lekki", "Lagos"],
  ["surulere", "Lagos"],
  ["victoria island", "Lagos"],
  ["ajah", "Lagos"],
  ["abuja", "FCT"],
  ["port harcourt", "Rivers"],
  ["benin", "Edo"],
  ["enugu", "Enugu"],
  ["onitsha", "Anambra"],
  ["awka", "Anambra"],
  ["kano", "Kano"],
  ["kaduna", "Kaduna"],
  ["jos", "Plateau"],
  ["asaba", "Delta"],
  ["warri", "Delta"],
  ["uyo", "Akwa Ibom"],
  ["calabar", "Cross River"]
]);

function normalizeToken(raw) {
  const token = (raw || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  if (!token) return "";
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("ers")) return token.slice(0, -1);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function extractQueryTerms(text) {
  const parts = (text || "").split(/\s+/g);
  const terms = [];
  for (const part of parts) {
    const token = normalizeToken(part);
    if (!token || token.length < 3 || STOP_WORDS.has(token)) continue;
    terms.push(token);
  }
  return [...new Set(terms)];
}

function inferVendorIntentFromText(query) {
  const terms = extractQueryTerms(query);
  return terms.some((term) => BUSINESS_INTENT_TERMS.has(term));
}

function inferServiceIntentFromText(query) {
  const terms = extractQueryTerms(query);
  return terms.some((term) => SERVICE_INTENT_TERMS.has(term));
}

function termVariants(term) {
  const variants = new Set([term]);
  if (term.length > 5 && term.endsWith("ers")) variants.add(term.slice(0, -3));
  if (term.length > 4 && term.endsWith("er")) variants.add(term.slice(0, -2));
  if (term.length > 5 && term.endsWith("ing")) variants.add(term.slice(0, -3));
  if (term.length > 4 && term.endsWith("ies")) variants.add(`${term.slice(0, -3)}y`);
  if (term.length > 4 && term.endsWith("y")) variants.add(term.slice(0, -1));
  if (term.length > 3 && term.endsWith("s")) variants.add(term.slice(0, -1));
  return [...variants].filter(Boolean);
}

function isLocationLikeTerm(term) {
  if (!term) return false;
  if (STATE_VALUES_LOWER.has(term)) return true;
  return CITY_TO_STATE.has(term);
}

function inferStateFromQuery(text) {
  const haystack = (text || "").toLowerCase();
  if (!haystack) return null;

  for (const [lowerState, originalState] of STATE_VALUES_LOWER.entries()) {
    if (haystack.includes(lowerState)) return originalState;
  }
  if (haystack.includes("federal capital territory")) return "FCT";

  for (const [city, state] of CITY_TO_STATE.entries()) {
    if (haystack.includes(city)) return state;
  }

  return null;
}

function shouldRouteToVendors(intent, rawQuery) {
  if (intent?.target === "vendors") return true;
  if (intent?.scope === "services") return true;
  return inferVendorIntentFromText(rawQuery);
}

async function loadServiceSignalsByStoreId(storeIds) {
  if (!supabaseAdmin || storeIds.length === 0) return new Map();

  const { data: serviceRows, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, store_id")
    .in("store_id", storeIds)
    .eq("is_active", true);

  if (serviceError || !serviceRows?.length) return new Map();

  const serviceIds = serviceRows.map((row) => row.id).filter(Boolean);
  if (serviceIds.length === 0) return new Map();

  const { data: itemRows, error: itemError } = await supabaseAdmin
    .from("service_items")
    .select("id, service_id, name, description, category, sub_category")
    .in("service_id", serviceIds)
    .eq("is_active", true);

  if (itemError || !itemRows?.length) return new Map();

  const itemIds = itemRows.map((row) => row.id).filter(Boolean);
  const { data: locationRows } = itemIds.length === 0
    ? { data: [] }
    : await supabaseAdmin
        .from("service_locations")
        .select("service_item_id, state, cities, cover_all_nigeria")
        .in("service_item_id", itemIds);

  const storeByServiceId = new Map(serviceRows.map((row) => [row.id, row.store_id]));
  const signalsByStoreId = new Map();
  const storeByItemId = new Map();

  const ensureSignals = (storeId) => {
    if (!signalsByStoreId.has(storeId)) {
      signalsByStoreId.set(storeId, {
        text: "",
        states: new Set(),
        cities: new Set(),
        coverAllNigeria: false
      });
    }
    return signalsByStoreId.get(storeId);
  };

  for (const item of itemRows) {
    const storeId = storeByServiceId.get(item.service_id);
    if (!storeId) continue;
    storeByItemId.set(item.id, storeId);
    const phrase = `${item.name || ""} ${item.description || ""} ${item.category || ""} ${item.sub_category || ""}`.trim();
    if (!phrase) continue;
    const signals = ensureSignals(storeId);
    signals.text = `${signals.text} ${phrase}`.trim();
  }

  for (const row of locationRows || []) {
    const storeId = storeByItemId.get(row.service_item_id);
    if (!storeId) continue;
    const signals = ensureSignals(storeId);
    if (row.cover_all_nigeria) signals.coverAllNigeria = true;
    if (row.state) signals.states.add(String(row.state).toLowerCase());
    if (Array.isArray(row.cities)) {
      for (const city of row.cities) {
        const normalized = String(city || "").trim().toLowerCase();
        if (normalized) signals.cities.add(normalized);
      }
    }
  }

  return signalsByStoreId;
}

async function filterVendorsByRelevance(vendors, rawQuery, intent) {
  if (!vendors?.length) return vendors;

  const candidateTerms = extractQueryTerms(intent?.cleanedQuery || rawQuery);
  if (candidateTerms.length === 0) return vendors;

  const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const serviceSignalsByStoreId = await loadServiceSignalsByStoreId([...vendorsById.keys()]);
  const inferredState = inferStateFromQuery(`${rawQuery || ""} ${intent?.cleanedQuery || ""}`);
  const serviceIntent = intent?.scope === "services" || inferServiceIntentFromText(rawQuery) || inferServiceIntentFromText(intent?.cleanedQuery || "");

  const scored = vendors.map((vendor) => {
    const ownText = `${vendor.storeName || ""} ${vendor.storeDescription || ""} ${vendor.state || ""}`.toLowerCase();
    const serviceSignals = serviceSignalsByStoreId.get(vendor.id) || {
      text: "",
      states: new Set(),
      cities: new Set(),
      coverAllNigeria: false
    };
    const serviceText = (serviceSignals.text || "").toLowerCase();
    const text = `${ownText} ${serviceText}`.trim();
    const meaningfulTerms = candidateTerms.filter((term) => !isLocationLikeTerm(term));

    let score = 0;
    let serviceSemanticHits = 0;
    for (const term of candidateTerms) {
      const variants = termVariants(term);
      let matchedInAny = false;
      let matchedInService = false;
      for (const variant of variants) {
        if (!variant) continue;
        if (text.includes(variant)) matchedInAny = true;
        if (serviceText.includes(variant)) matchedInService = true;
      }
      if (matchedInAny) score += 1;
      if (matchedInService) {
        score += 1;
        if (meaningfulTerms.includes(term)) serviceSemanticHits += 1;
      }
      if (serviceSignals.states.has(term)) score += 2;
      if (serviceSignals.cities.has(term)) score += 2;
    }

    if ((intent?.cleanedQuery || "").trim() && text.includes(intent.cleanedQuery.toLowerCase())) {
      score += 2;
    }

    if (inferredState) {
      const vendorState = String(vendor.state || "").toLowerCase();
      const inferredStateLower = inferredState.toLowerCase();
      if (vendorState === inferredStateLower) score += 3;
      if (serviceSignals.states.has(inferredStateLower)) score += 3;
      if (serviceSignals.coverAllNigeria) score += 1;
    }

    return { vendor, score, serviceSemanticHits };
  });

  const minScore = candidateTerms.length >= 3 ? 2 : 1;
  const filtered = scored
    .filter((row) => row.score >= minScore)
    .filter((row) => !serviceIntent || row.serviceSemanticHits > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.vendor);

  return filtered;
}

async function resolveQueryUnderstanding(query) {
  const intent = await extractSearchIntent(query);
  if (!intent) return null;

  const embeddingTarget = intent.cleanedQuery?.trim() || query;
  const embedding = await embedText(embeddingTarget);
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
    const requestedPrimary = searchParams.get("primary") === "vendors" ? "vendors" : "products";
    // /vendors' scope toggle (see search_vendors_services migration) --
    // only meaningful for the vendor-search calls below, never the
    // product-search ones.
    const scopeParam = searchParams.get("scope");
    const scope = scopeParam === "products" || scopeParam === "services" ? scopeParam : undefined;
    // Opt-in, additive params -- existing callers never pass these, so
    // today's behavior (LLM's own freeform category guess) is unchanged.
    // When present, Biterave forces the category to Food via a real,
    // indexed is_meal_item column (search_biterave_*, see
    // 20260905000000_biterave_search.sql) instead of trusting the
    // extraction model's own guess -- a food-only storefront can't let an
    // occasional misclassification leak a non-food result.
    const isBiterave = searchParams.get("source") === "biterave";
    const mealOnly = searchParams.get("type") !== "groceries";
    // Only meaningful with source=biterave -- scopes results to one
    // restaurant's own menu (apps/store/src/app/biterave/[storeSlug]),
    // rather than the whole Biterave catalog /biterave/meals and
    // /biterave/groceries search across.
    const storeId = searchParams.get("storeId") || undefined;
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
    const inferredStateFromQuery = inferStateFromQuery(query) || undefined;

    const understanding = await cached(
      cacheKey.aiSearch(query),
      AI_SEARCH_CACHE_TTL_SECONDS,
      () => resolveQueryUnderstanding(query)
    );

    let products, productTotal, vendors, vendorTotal, mode;
    let resolvedPrimary = requestedPrimary;

    if (understanding) {
      mode = "ai";
      const { intent, embedding } = understanding;
      if (shouldRouteToVendors(intent, query)) {
        resolvedPrimary = "vendors";
      }
      const inferredStateFromIntent = inferStateFromQuery(intent.cleanedQuery || "") || undefined;
      const effectiveState = state || inferredStateFromIntent || inferredStateFromQuery;
      const categories = intent.category ? [intent.category] : undefined;
      const serviceIntent = intent.scope === "services" || inferServiceIntentFromText(query) || inferServiceIntentFromText(intent.cleanedQuery || "");
      const vendorScope = intent.scope === "services" || intent.scope === "products"
        ? intent.scope
        : (serviceIntent ? "services" : scope);
      const productOffset = resolvedPrimary === "products" ? offset : 0;
      const productLimit = resolvedPrimary === "products" ? PAGE_SIZE : SECONDARY_LIMIT;
      const vendorOffset = resolvedPrimary === "vendors" ? offset : 0;
      const vendorLimit = resolvedPrimary === "vendors" ? PAGE_SIZE : SECONDARY_LIMIT;

      const [productResult, vendorResult] = isBiterave
        ? await Promise.all([
            searchBiteraveProductsByEmbedding({
              mealOnly,
              embedding,
              storeId,
              minPrice: intent.priceMin ?? undefined,
              maxPrice: intent.priceMax ?? undefined,
              state: effectiveState,
              buyerState,
              deliverableOnly,
              limit: productLimit,
              offset: productOffset
            }),
            searchBiteraveVendorsByEmbedding({
              mealOnly,
              embedding,
              state: effectiveState,
              buyerState,
              deliverableOnly,
              limit: vendorLimit,
              offset: vendorOffset
            })
          ])
        : await Promise.all([
            searchProductsByEmbedding({
              embedding,
              categories,
              minPrice: intent.priceMin ?? undefined,
              maxPrice: intent.priceMax ?? undefined,
              state: effectiveState,
              buyerState,
              deliverableOnly,
              limit: productLimit,
              offset: productOffset
            }),
            searchVendorsByEmbedding({
              embedding,
              categories,
              state: effectiveState,
              buyerState,
              deliverableOnly,
              scope: vendorScope,
              limit: vendorLimit,
              offset: vendorOffset
            })
          ]);
      ({ products, totalCount: productTotal } = productResult);
      ({ vendors, totalCount: vendorTotal } = vendorResult);

      if (resolvedPrimary === "vendors") {
        const filteredVendors = await filterVendorsByRelevance(vendors, rawQuery, intent);
        vendors = filteredVendors;
        vendorTotal = filteredVendors.length;
        if (vendorScope === "services") {
          products = [];
          productTotal = 0;
        }
      }
    } else {
      // Fallback: extraction or embedding failed (bad/missing API key,
      // provider timeout, invalid model output) -- degrade to the same
      // plain keyword search /api/products/search and /api/vendors/search
      // already use, rather than surfacing an error for something the
      // customer has no way to fix.
      mode = "keyword-fallback";
      const fallbackState = state || inferredStateFromQuery;
      const [productResult, vendorResult] = isBiterave
        ? await Promise.all([
            searchBiteraveProducts({
              mealOnly,
              search: query,
              storeId,
              state: fallbackState,
              buyerState,
              deliverableOnly,
              limit: requestedPrimary === "products" ? PAGE_SIZE : SECONDARY_LIMIT,
              offset: requestedPrimary === "products" ? offset : 0
            }),
            searchBiteraveVendors({
              mealOnly,
              search: query,
              state: fallbackState,
              buyerState,
              deliverableOnly,
              limit: requestedPrimary === "vendors" ? PAGE_SIZE : SECONDARY_LIMIT,
              offset: requestedPrimary === "vendors" ? offset : 0
            })
          ])
        : await Promise.all([
            searchProductsPaginated({
              search: query,
              state: fallbackState,
              buyerState,
              deliverableOnly,
              limit: requestedPrimary === "products" ? PAGE_SIZE : SECONDARY_LIMIT,
              offset: requestedPrimary === "products" ? offset : 0
            }),
            searchVendorsPaginated({
              search: query,
              state: fallbackState,
              buyerState,
              deliverableOnly,
              scope,
              limit: requestedPrimary === "vendors" ? PAGE_SIZE : SECONDARY_LIMIT,
              offset: requestedPrimary === "vendors" ? offset : 0
            })
          ]);
      ({ products, totalCount: productTotal } = productResult);
      ({ vendors, totalCount: vendorTotal } = vendorResult);
    }

    const primaryTotal = resolvedPrimary === "products" ? productTotal : vendorTotal;

    return NextResponse.json({
      success: true,
      mode,
      query: rawQuery,
      requestedPrimary,
      resolvedPrimary,
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
