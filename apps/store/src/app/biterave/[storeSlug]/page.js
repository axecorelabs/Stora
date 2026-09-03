import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ChefHat, Store } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import FoodItemCard from "@/components/biterave/FoodItemCard";
import { findStoreByWebsitePath, searchStoreProducts } from "@/lib/supabaseStore";
import { resolveRequestHost } from "@/lib/vendorHost";
import { isMealItem } from "@/lib/biteraveClassification";

// Same menu-section order FoodDetailsSection.js's own dropdown uses in
// apps/dashboard, so a restaurant's menu reads top-to-bottom the way a
// real menu would rather than in arbitrary DB order.
const MENU_SECTION_ORDER = ["Starters", "Mains", "Sides", "Desserts", "Drinks"];
const FALLBACK_SECTION = "Menu";

function groupByMenuSection(products) {
  const groups = new Map();
  for (const product of products) {
    const section = product.categoryDetails?.food?.menuSection;
    const key = section && section !== "Other" ? section : FALLBACK_SECTION;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }

  const orderedKeys = [
    ...MENU_SECTION_ORDER.filter((key) => groups.has(key)),
    ...[...groups.keys()].filter((key) => !MENU_SECTION_ORDER.includes(key))
  ];
  return orderedKeys.map((key) => ({ section: key, items: groups.get(key) }));
}

// Requires store.website?.isEnabled, same as app/[slug]/page.js -- and for
// the same reason search_vendors()/search_products() (the RPCs behind the
// landing page's restaurant list and pooled grid) already enforce this at
// the SQL level (see 20260817000006_exclude_disabled_website_stores.sql):
// it's the vendor's own "publish/unpublish my public storefront" toggle,
// and a vendor who has switched it off must not be reachable through ANY
// public listing -- including a deep link straight to this page -- not
// just omitted from the landing page while still orderable directly.
async function loadRestaurant(storeSlug) {
  const store = await findStoreByWebsitePath(storeSlug);
  if (!store || !store.website?.isEnabled) return null;

  const { products } = await searchStoreProducts(store.id, { category: "Food", limit: 100 });
  return { store, products };
}

export async function generateMetadata({ params }) {
  const { storeSlug } = await params;
  const data = await loadRestaurant(storeSlug);
  if (!data) return { title: "Restaurant not found" };

  const hdrs = await headers();
  const host = resolveRequestHost({ headers: hdrs }) || "biterave.stora.com.ng";
  const url = `https://${host}/biterave/${storeSlug}`;
  const title = `${data.store.storeName} - Biterave`;
  const description = data.store.storeDescription || `Order food from ${data.store.storeName} on Biterave.`;
  const image = data.store.branding?.banner || data.store.branding?.logo || "/og-image.jpg";

  return {
    title,
    description,
    openGraph: { title, description, url, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function BiteraveRestaurantPage({ params }) {
  const { storeSlug } = await params;
  const data = await loadRestaurant(storeSlug);
  if (!data) notFound();

  const { store, products } = data;
  const meals = products.filter(isMealItem);
  const groceries = products.filter((p) => !isMealItem(p));
  const menuSections = groupByMenuSection(meals);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader brand="biterave" />

      <div className="bg-brand-800">
        {store.branding?.banner && (
          <div className="h-40 sm:h-56 w-full overflow-hidden">
            <img src={store.branding.banner} alt="" className="w-full h-full object-cover opacity-90" />
          </div>
        )}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
            {store.branding?.logo ? (
              <img src={store.branding.logo} alt={store.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-6 h-6 text-white/70" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white truncate">{store.storeName}</h1>
            {store.storeDescription && (
              <p className="text-white/60 text-sm mt-0.5 line-clamp-2">{store.storeDescription}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <ChefHat className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">This restaurant has no items on Biterave yet.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {menuSections.length > 0 && (
              <div className="space-y-10">
                {menuSections.map(({ section, items }) => (
                  <div key={section}>
                    <h2 className="font-display text-lg font-bold text-brand-900 mb-4">{section}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {items.map((product) => (
                        <FoodItemCard key={product.id} product={product} storeSlug={store.storeSlug} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {groceries.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-bold text-brand-900 mb-4">Groceries</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {groceries.map((product) => (
                    <FoodItemCard key={product.id} product={product} storeSlug={store.storeSlug} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <SiteFooter brand="biterave" />
    </div>
  );
}
