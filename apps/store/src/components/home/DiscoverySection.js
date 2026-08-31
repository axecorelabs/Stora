"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";
import DiscoveryProductCard from "./DiscoveryProductCard";
import PrefetchLink from "@/components/ui/PrefetchLink";
import { CATEGORIES } from "@/lib/categories";

// Homepage teaser only -- a curated trending/new taste of the catalog, not
// a search results view (that's /products now, see HeroSearch). Category
// chips stay here since they're a nice way to sample the catalog without
// leaving the homepage; free-text search lives on the dedicated page.
export default function DiscoverySection() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState(null);
  const [sort, setSort] = useState("trending");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, limit: "12" });
      if (category) params.set("category", category);
      const res = await fetch(`/api/products/discover?${params}`);
      const data = await res.json();
      if (data.success) setProducts(data.products || []);
    } catch (error) {
      console.error("Error loading discovery products:", error);
    } finally {
      setLoading(false);
    }
  }, [category, sort]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-8 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        <button
          onClick={() => setCategory(null)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
            !category
              ? "bg-brand-700 text-white border-brand-700"
              : "bg-white text-brand-800 border-brand-100 hover:border-brand-300"
          }`}
        >
          All
        </button>
        {CATEGORIES.map(({ value, icon: Icon }) => (
          <PrefetchLink
            key={value}
            href={`/products?category=${encodeURIComponent(value)}`}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border bg-white text-brand-800 border-brand-100 hover:border-brand-300"
          >
            <Icon className="w-3.5 h-3.5" />
            {value}
          </PrefetchLink>
        ))}
      </div>

      {/* Sort toggle */}
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

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 aspect-[3/4] animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-gray-500 text-sm">Nothing here yet -- try a different category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map((product) => (
            <DiscoveryProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
        >
          Browse all products
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
