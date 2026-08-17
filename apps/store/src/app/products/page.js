"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Loader2 } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import SearchModeTabs from "@/components/search/SearchModeTabs";
import SearchBar from "@/components/search/SearchBar";
import DiscoveryProductCard from "@/components/home/DiscoveryProductCard";
import { CATEGORIES } from "@/lib/categories";

function ProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get("q") || "";
  const urlCategory = searchParams.get("category") || "";
  const urlSort = searchParams.get("sort") === "new" ? "new" : "trending";

  const [q, setQ] = useState(urlQ);
  const [category, setCategory] = useState(urlCategory);
  const [sort, setSort] = useState(urlSort);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Keep the URL in sync (shallow, no scroll jump) so results are
  // shareable/bookmarkable and survive a refresh or back-navigation.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (sort !== "trending") params.set("sort", sort);
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, sort]);

  const fetchPage = useCallback(async (pageNum, replace) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort, page: String(pageNum) });
      if (q) params.set("q", q);
      if (category) params.set("category", category);
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
  }, [q, category, sort]);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (!pagination || loadingMore) return;
    fetchPage(pagination.page + 1, false);
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
          <p className="text-sm text-gray-500">
            {loading ? "Searching…" : `${pagination?.total?.toLocaleString() ?? 0} product${pagination?.total === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="mb-6">
          <SearchBar value={q} onChange={setQ} placeholder="Search products by name…" />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <button
            onClick={() => setCategory("")}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              !category
                ? "bg-brand-700 text-white border-brand-700"
                : "bg-white text-brand-800 border-brand-100 hover:border-brand-300"
            }`}
          >
            All categories
          </button>
          {CATEGORIES.map(({ value, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                category === value
                  ? "bg-brand-700 text-white border-brand-700"
                  : "bg-white text-brand-800 border-brand-100 hover:border-brand-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {value}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center justify-end gap-1 mb-6">
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

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 aspect-[3/4] animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm">
              {q ? `No products match "${q}".` : "Nothing here yet -- try a different category."}
            </p>
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
