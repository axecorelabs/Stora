"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Loader2, Truck } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import SearchModeTabs from "@/components/search/SearchModeTabs";
import SearchConsole from "@/components/search/SearchConsole";
import PriceFilterPills, { PRICE_BUCKETS } from "@/components/search/PriceFilterPills";
import ActiveFilters from "@/components/search/ActiveFilters";
import DiscoveryProductCard from "@/components/home/DiscoveryProductCard";
import StatePickerPopover from "@/components/ui/StatePickerPopover";
import MobileFilterBar from "@/components/search/MobileFilterBar";
import { useDeliveryState } from "@/contexts/DeliveryStateContext";

const SORTS = [
  { key: "trending", label: "Trending" },
  { key: "new", label: "New arrivals" },
  { key: "nearest", label: "Nearest to me" },
];

function ProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { deliveryState, setDeliveryState } = useDeliveryState();

  const urlQ = searchParams.get("q") || "";
  const urlCategories = searchParams.get("category")?.split(",").filter(Boolean) || [];
  const urlState = searchParams.get("state") || "";
  const urlSort = SORTS.some((s) => s.key === searchParams.get("sort")) ? searchParams.get("sort") : "trending";
  const urlPriceKey = searchParams.get("price") || "";
  const urlDeliverableOnly = searchParams.get("deliverableOnly") === "true";

  const [q, setQ] = useState(urlQ);
  const [categories, setCategories] = useState(urlCategories);
  const [state, setState] = useState(urlState);
  const [sort, setSort] = useState(urlSort);
  const [priceKey, setPriceKey] = useState(urlPriceKey);
  const [deliverableOnly, setDeliverableOnly] = useState(urlDeliverableOnly);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showNearestPicker, setShowNearestPicker] = useState(false);
  const [showDeliverablePicker, setShowDeliverablePicker] = useState(false);

  const priceBucket = PRICE_BUCKETS.find((b) => b.key === priceKey);

  // Keep the URL in sync (shallow, no scroll jump) so results are
  // shareable/bookmarkable and survive a refresh or back-navigation.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categories.length) params.set("category", categories.join(","));
    if (state) params.set("state", state);
    if (sort !== "trending") params.set("sort", sort);
    if (priceKey) params.set("price", priceKey);
    if (deliverableOnly) params.set("deliverableOnly", "true");
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categories, state, sort, priceKey, deliverableOnly]);

  const fetchPage = useCallback(async (pageNum, replace) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort, page: String(pageNum) });
      if (q) params.set("q", q);
      if (categories.length) params.set("category", categories.join(","));
      if (state) params.set("state", state);
      // buyerState powers both "nearest" (soft, reorders only) and
      // deliverableOnly (hard filter) -- either needs it sent regardless
      // of which triggered it.
      if ((sort === "nearest" || deliverableOnly) && deliveryState) params.set("buyerState", deliveryState);
      if (deliverableOnly && deliveryState) params.set("deliverableOnly", "true");
      if (priceBucket?.min !== undefined) params.set("minPrice", String(priceBucket.min));
      if (priceBucket?.max !== undefined) params.set("maxPrice", String(priceBucket.max));
      const res = await fetch(`/api/products/search?${params}`);
      const data = await res.json();
      if (data.success) {
        setProducts((prev) => (replace ? data.products : [...prev, ...data.products]));
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error searching products:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [q, categories, state, sort, priceBucket, deliverableOnly, deliveryState]);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (!pagination || loadingMore) return;
    fetchPage(pagination.page + 1, false);
  };

  const activeFilters = [
    ...categories.map((c) => ({
      key: `category-${c}`,
      label: c,
      onRemove: () => setCategories((prev) => prev.filter((x) => x !== c))
    })),
    state && { key: "state", label: state, onRemove: () => setState("") },
    priceBucket && { key: "price", label: priceBucket.label, onRemove: () => setPriceKey("") },
    deliverableOnly && { key: "deliverable", label: `Delivers to ${deliveryState}`, onRemove: () => setDeliverableOnly(false) }
  ].filter(Boolean);

  const clearAll = () => {
    setCategories([]);
    setState("");
    setPriceKey("");
    setDeliverableOnly(false);
  };

  // "Nearest to me" needs a delivery state to sort against -- if none is
  // set yet, open the picker right here instead of silently applying a
  // no-op sort (which would look identical to Trending and be confusing).
  const handleSortClick = (key) => {
    if (key === "nearest" && !deliveryState) {
      setShowNearestPicker(true);
      return;
    }
    setSort(key);
  };

  // Same "need a state first" gate as the sort above -- this filter is a
  // no-op without one to filter against.
  const handleDeliverableToggle = () => {
    if (deliverableOnly) {
      setDeliverableOnly(false);
      return;
    }
    if (!deliveryState) {
      setShowDeliverablePicker(true);
      return;
    }
    setDeliverableOnly(true);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SearchModeTabs query={q} />

        <div className="mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 mb-1">
            {q ? `Results for "${q}"` : "All products"}
          </h1>
        </div>

        <SearchConsole
          query={q}
          onQueryChange={setQ}
          searchPlaceholder="Search products by name…"
          categories={categories}
          onCategoriesChange={setCategories}
          state={state}
          onStateChange={setState}
          resultCount={pagination?.total}
          loading={loading}
          resultLabel="products"
        />

        {activeFilters.length > 0 && (
          <div className="flex justify-center mb-6">
            <ActiveFilters filters={activeFilters} onClearAll={clearAll} />
          </div>
        )}

        <MobileFilterBar
          categories={categories}
          onCategoriesChange={setCategories}
          state={state}
          onStateChange={setState}
          priceKey={priceKey}
          onPriceChange={setPriceKey}
          sort={sort}
          onSortChange={setSort}
          sortOptions={SORTS}
          deliveryState={deliveryState}
          onDeliveryStateChange={setDeliveryState}
          deliverableOnly={deliverableOnly}
          onDeliverableOnlyChange={setDeliverableOnly}
        />

        {/* Price + delivery toggle + sort -- opposite top corners of the
            grid they control. Desktop-only; MobileFilterBar covers this
            below `sm`. */}
        <div className="hidden sm:flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <PriceFilterPills activeKey={priceKey} onChange={setPriceKey} />

            <div className="relative">
              <button
                onClick={handleDeliverableToggle}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  deliverableOnly
                    ? "bg-brand-700 text-white border-brand-700"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
                title={deliveryState ? `Only stores that deliver to ${deliveryState}` : "Set your delivery state to filter by it"}
              >
                <Truck className="w-3.5 h-3.5" />
                Deliverable to me
              </button>

              {showDeliverablePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDeliverablePicker(false)} />
                  <div className="absolute left-0 top-full mt-2 z-50">
                    <StatePickerPopover
                      value={deliveryState}
                      onChange={(value) => {
                        setDeliveryState(value);
                        if (value) setDeliverableOnly(true);
                        setShowDeliverablePicker(false);
                      }}
                      onRequestClose={() => setShowDeliverablePicker(false)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="relative flex items-center gap-1 flex-shrink-0">
            {SORTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSortClick(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sort === key ? "bg-brand-50 text-brand-800" : "text-gray-500 hover:text-brand-700"
                }`}
              >
                {label}
              </button>
            ))}

            {showNearestPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNearestPicker(false)} />
                <div className="absolute right-0 top-full mt-2 z-50">
                  <StatePickerPopover
                    value={deliveryState}
                    onChange={(value) => {
                      setDeliveryState(value);
                      if (value) setSort("nearest");
                      setShowNearestPicker(false);
                    }}
                    onRequestClose={() => setShowNearestPicker(false)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Results */}
        <div id="search-results">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 aspect-[3/4] animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm mb-4">
              {q ? `No products match "${q}".` : "Nothing matches these filters."}
            </p>
            {activeFilters.length > 0 && (
              <button
                onClick={clearAll}
                className="text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {products.map((product) => (
                <DiscoveryProductCard key={product.id} product={product} />
              ))}
            </div>

            {pagination?.hasMore && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50/50 transition-colors disabled:opacity-50"
                >
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loadingMore ? "Loading…" : `Load more (${products.length} of ${pagination.total.toLocaleString()})`}
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsPageInner />
    </Suspense>
  );
}
