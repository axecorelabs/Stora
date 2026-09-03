"use client";
import { useMemo, useState } from "react";
import { Search, ChefHat } from "lucide-react";
import FoodItemCard from "./FoodItemCard";

// Client-side text filter over the already-fetched menu/groceries arrays
// (the whole store's food catalogue is fetched once, server-side, by
// /biterave/[storeSlug]/page.js) -- mirrors StoreWebsite.js's own mobile
// in-store search, which also filters an already-loaded array rather than
// issuing a new request; right-sized here for the same reason (a single
// vendor's catalogue is small).
//
// Deliberately keyword-only, no AI mode -- tried on this page, then
// removed: one restaurant's menu is already small enough to browse or
// filter by name, and AI search stays where it earns its keep (the
// cross-vendor /biterave/meals, /biterave/groceries, /biterave/restaurants
// pages, searching a catalogue too large to just scan).
export default function BiteraveStoreMenu({ storeSlug, menuSections, groceries }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

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
  const hasAnyResults = filteredMenuSections.some(({ items }) => items.length > 0) || filteredGroceries.length > 0;

  if (!hasAnyItemsAtAll) {
    return (
      <div className="text-center py-16">
        <ChefHat className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">This restaurant has no items on Biterave yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative mb-8 max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this menu..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
        />
      </div>

      {!hasAnyResults ? (
        <p className="text-sm text-gray-400 py-12 text-center">No items match &quot;{query}&quot;.</p>
      ) : (
        <div className="space-y-12">
          {filteredMenuSections.length > 0 && (
            <div className="space-y-10">
              {filteredMenuSections.map(({ section, items }) => (
                <div key={section}>
                  <h2 className="font-display text-lg font-bold text-brand-900 mb-4">{section}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map((product) => (
                      <FoodItemCard key={product.id} product={product} storeSlug={storeSlug} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredGroceries.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-bold text-brand-900 mb-4">Groceries</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredGroceries.map((product) => (
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
