"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Search, Package, CheckCircle2, AlertTriangle, Tags } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import StatStrip from "@/components/StatStrip";
import StoreLogo from "@/components/StoreLogo";
import ProductThumbnail from "@/components/ProductThumbnail";
import ToggleSwitch from "@/components/ToggleSwitch";
import Pagination from "@/components/Pagination";
import CustomDropdown from "@/components/ui/CustomDropdown";

const PAGE_SIZE = 50;

function ProductsPageContent() {
  const { secureApiCall } = useAuth();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loadingId, setLoadingId] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ stores: [], categories: [], stats: null });

  // Reset to page 1 when filters change -- setState during render, guarded
  // by a prev-value comparison (React's own "adjusting state when a prop
  // changes" pattern), not an effect.
  const [prevFilters, setPrevFilters] = useState({ query, storeFilter, categoryFilter });
  if (query !== prevFilters.query || storeFilter !== prevFilters.storeFilter || categoryFilter !== prevFilters.categoryFilter) {
    setPrevFilters({ query, storeFilter, categoryFilter });
    setPage(1);
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await secureApiCall("/api/products/filters");
        if (data.success) setFilterOptions(data);
      } catch (error) {
        console.error("Error loading product filters:", error);
      }
    })();
  }, [secureApiCall]);

  const load = useCallback(async (params) => {
    setLoading(true);
    try {
      const search = new URLSearchParams();
      if (params.q) search.set("q", params.q);
      if (params.storeId) search.set("storeId", params.storeId);
      if (params.category) search.set("category", params.category);
      search.set("offset", String((params.page - 1) * PAGE_SIZE));
      const data = await secureApiCall(`/api/products?${search.toString()}`);
      if (data.success) {
        setProducts(data.products);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  }, [secureApiCall]);

  useEffect(() => {
    const timeout = setTimeout(() => load({ q: query, storeId: storeFilter, category: categoryFilter, page }), 300);
    return () => clearTimeout(timeout);
  }, [query, storeFilter, categoryFilter, page, load]);

  const handleToggle = async (productId, nextValue) => {
    setLoadingId(productId);
    try {
      const data = await secureApiCall(`/api/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextValue })
      });
      if (data.success) {
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, isActive: data.product.isActive } : p)));
      }
    } catch (error) {
      console.error("Error updating product status:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const stats = filterOptions.stats;
  const statRows = stats
    ? [
        { key: "total", icon: Package, tone: "brand", label: "Products", value: stats.total, sub: "platform-wide" },
        { key: "active", icon: CheckCircle2, tone: "brand", label: "Active", value: stats.active, sub: `${stats.total - stats.active} disabled` },
        { key: "oos", icon: AlertTriangle, tone: "gold", label: "Out of stock", value: stats.outOfStock, sub: "0 units across variants" },
        { key: "categories", icon: Tags, tone: "gold", label: "Categories", value: stats.categories, sub: "in use" }
      ]
    : [];

  const storeOptions = [{ value: "", label: "All vendors" }, ...filterOptions.stores.map((s) => ({ value: s.id, label: s.storeName }))];
  const categoryOptions = [{ value: "", label: "All categories" }, ...filterOptions.categories.map((c) => ({ value: c, label: c }))];

  return (
    <div className="space-y-4">
      {stats && <StatStrip rows={statRows} />}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="pl-9 pr-3 py-2 w-full sm:w-64 md:w-80 bg-gray-50 border-0 rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-brand-800 focus:bg-white text-sm transition-all duration-200"
          />
        </div>
        <CustomDropdown options={storeOptions} value={storeFilter} onChange={setStoreFilter} className="w-full sm:w-48" searchable />
        <CustomDropdown options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} className="w-full sm:w-44" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 text-brand-700 animate-spin" />
        </div>
      ) : (
        <>
          <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-sm text-gray-400 text-center">No products found.</td>
                  </tr>
                )}
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProductThumbnail imageUrl={product.imageUrl} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{product.name}</p>
                          <p className="text-xs text-gray-400 truncate">{product.sku || "No SKU"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StoreLogo logoUrl={product.store?.logoUrl} size={24} />
                        <span className="text-gray-700 truncate">{product.store?.storeName || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{product.category}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                      ₦{product.basePrice.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {product.stockQuantity}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${product.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                        {product.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <ToggleSwitch
                          checked={product.isActive}
                          loading={loadingId === product.id}
                          onChange={(next) => handleToggle(product.id, next)}
                          label="Enable/disable this listing"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
        </>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <AdminLayout title="Products" subtitle="Every listing across every vendor.">
      <ProductsPageContent />
    </AdminLayout>
  );
}
