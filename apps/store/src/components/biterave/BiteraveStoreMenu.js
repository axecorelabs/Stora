"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, ChefHat } from "lucide-react";
import AISearchInput from "@/components/search/AISearchInput";
import FoodItemCard from "./FoodItemCard";

// Keyword mode: client-side text filter over the already-fetched menu/
// groceries arrays (the whole store's food catalogue is fetched once,
// server-side, by /biterave/[storeSlug]/page.js) -- mirrors
// StoreWebsite.js's own mobile in-store search, which also filters an
// already-loaded array rather than issuing a new request; right-sized
// here for the same reason (a single vendor's catalogue is small).
//
// AI mode: hits the same /api/search/ai route /biterave/meals and
// /biterave/groceries use, scoped to THIS store via storeId (see
// 20260906000000_biterave_store_ai_search.sql) -- was missing entirely
// before, an inconsistency with the other two Biterave browse pages
// rather than a deliberate cut. Fires one AI query per section (menu,
// groceries) in parallel since this page shows both together; AI results
// are ranked by relevance, not grouped by menu section like the keyword
// view is.
export default function BiteraveStoreMenu({ storeId, storeSlug, menuSections, groceries }) {
  const [query, setQuery] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [aiMenuItems, setAiMenuItems] = useState(null);
  const [aiGroceryItems, setAiGroceryItems] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const q = query.trim().toLowerCase();

  useEffect(() => {
    if (!aiMode) return;
    if (!query.trim()) {
      setAiMenuItems(null);
      setAiGroceryItems(null);
      return;
    }

    let cancelled = false;
    setAiLoading(true);
    const params = (type) => new URLSearchParams({ q: query, source: "biterave", type, storeId, primary: "products" });

    Promise.all([
      fetch(`/api/search/ai?${params("meals")}`).then((r) => r.json()),
      fetch(`/api/search/ai?${params("groceries")}`).then((r) => r.json())
    ])
      .then(([menuData, groceryData]) => {
        if (cancelled) return;
        setAiMenuItems(menuData.success ? menuData.products : []);
        setAiGroceryItems(groceryData.success ? groceryData.products : []);
      })
      .catch((err) => {
        console.error("Error running in-store AI search:", err);
        if (!cancelled) {
          setAiMenuItems([]);
          setAiGroceryItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [aiMode, query, storeId]);

  const filteredMenuSections = useMemo(() => {
    if (!q) return menuSections;
    return menuSections
      .map(({ section, items }) => ({
        section,
        items: items.filter((p) => p.productName?.toLowerCase().includes(q))
      }))
      .filter(({ items }) => items.length > 0);
  }, [menuSections, q]);

  const filteredGroceries = useMemo(() => {
    if (!q) return groceries;
    return groceries.filter((p) => p.productName?.toLowerCase().includes(q));
  }, [groceries, q]);

  const hasAnyItemsAtAll = menuSections.some(({ items }) => items.length > 0) || groceries.length > 0;

  if (!hasAnyItemsAtAll) {
    return (
      <div className="text-center py-16">
        <ChefHat className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">This restaurant has no items on Biterave yet.</p>
      </div>
    );
  }

  const showingAi = aiMode && query.trim();
  const menuToShow = showingAi ? [{ section: "Menu", items: aiMenuItems || [] }] : filteredMenuSections;
  const groceriesToShow = showingAi ? aiGroceryItems || [] : filteredGroceries;
  const hasAnyResults = menuToShow.some(({ items }) => items.length > 0) || groceriesToShow.length > 0;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        {aiMode ? (
          <div
            className="flex-1 rounded-2xl p-[1.5px]"
            style={{
              background: "linear-gradient(115deg, #D8BC85 0%, rgba(216,188,133,0) 35%, rgba(20,92,65,0) 65%, #145C41 100%)"
            }}
          >
            <div className="flex items-start bg-white px-6 py-3.5 rounded-2xl shadow-[0_1px_2px_rgba(11,59,46,0.04),0_20px_48px_-16px_rgba(11,59,46,0.2)]">
              <AISearchInput value={query} onChange={setQuery} placeholder="Describe what you're craving from this menu..." />
            </div>
          </div>
        ) : (
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this menu..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
            />
          </div>
        )}
        <button
          onClick={() => {
            setAiMode((v) => !v);
            setQuery("");
          }}
          className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors self-start ${
            aiMode ? "bg-brand-700 text-white border-brand-700" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Ask Biterave AI
        </button>
      </div>

      {showingAi && aiLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 aspect-[3/4] animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : showingAi && !query.trim() ? null : !hasAnyResults ? (
        <p className="text-sm text-gray-400 py-12 text-center">
          {showingAi ? `No AI matches for "${query}".` : `No items match "${query}".`}
        </p>
      ) : (
        <div className="space-y-12">
          {menuToShow.some(({ items }) => items.length > 0) && (
            <div className="space-y-10">
              {menuToShow.map(({ section, items }) =>
                items.length === 0 ? null : (
                  <div key={section}>
                    <h2 className="font-display text-lg font-bold text-brand-900 mb-4">{section}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {items.map((product) => (
                        <FoodItemCard key={product.id} product={product} storeSlug={storeSlug} />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {groceriesToShow.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-bold text-brand-900 mb-4">Groceries</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {groceriesToShow.map((product) => (
                  <FoodItemCard key={product.id} product={product} storeSlug={storeSlug} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
