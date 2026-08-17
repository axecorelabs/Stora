"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Loader2 } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import SearchModeTabs from "@/components/search/SearchModeTabs";
import SearchConsole from "@/components/search/SearchConsole";
import PriceFilterPills, { PRICE_BUCKETS } from "@/components/search/PriceFilterPills";
import ActiveFilters from "@/components/search/ActiveFilters";
import DiscoveryProductCard from "@/components/home/DiscoveryProductCard";

function ProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get("q") || "";
  const urlCategory = searchParams.get("category") || "";
  const urlSort = searchParams.get("sort") === "new" ? "new" : "trending";
  const urlPriceKey = searchParams.get("price") || "";

  const [q, setQ] = useState(urlQ);
  const [category, setCategory] = useState(urlCategory);
  const [sort, setSort] = useState(urlSort);
  const [priceKey, setPriceKey] = useState(urlPriceKey);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const priceBucket = PRICE_BUCKETS.find((b) => b.key === priceKey);

  // Keep the URL in sync (shallow, no scroll jump) so results are
  // shareable/bookmarkable and survive a refresh or back-navigation.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (sort !== "trending") params.set("sort", sort);
    if (priceKey) params.set("price", priceKey);
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, sort, priceKey]);

  const fetchPage = useCallback(async (pageNum, replace) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort, page: String(pageNum) });
      if (q) params.set("q", q);
      if (category) params.set("category", category);
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
  }, [q, category, sort, priceBucket]);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (!pagination || loadingMore) return;
    fetchPage(pagination.page + 1, false);
  };

  const activeFilters = [
    category && { key: "category", label: category, onRemove: () => setCategory("") },
    priceBucket && { key: "price", label: priceBucket.label, onRemove: () => setPriceKey("") }
  ].filter(Boolean);

  const clearAll = () => {
    setCategory("");
    setPriceKey("");
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
          category={category}
          onCategoryChange={setCategory}
          resultCount={pagination?.total}
          loading={loading}
          resultLabel="products"
        />

        {activeFilters.length > 0 && (
          <div className="flex justify-center mb-6">
            <ActiveFilters filters={activeFilters} onClearAll={clearAll} />
          </div>
        )}

        {/* Price + sort -- opposite top corners of the grid they control. */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <PriceFilterPills activeKey={priceKey} onChange={setPriceKey} />

          <div className="flex items-center gap-1 flex-shrink-0">
            {[
              { key: "trending", label: "Trending" },
              { key: "new", label: "New arrivals" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sort === key ? "bg-brand-50 text-brand-800" : "text-gray-500 hover:text-brand-700"
                }`}
              >
                {label}
              </button>
            ))}
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
