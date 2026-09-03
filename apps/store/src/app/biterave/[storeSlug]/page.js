import { headers, cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import BiteraveAuthGateProvider from "@/components/biterave/BiteraveAuthGateProvider";
import BiteraveRestaurantHero from "@/components/biterave/BiteraveRestaurantHero";
import BiteraveStoreMenu from "@/components/biterave/BiteraveStoreMenu";
import { findStoreByWebsitePath, searchStoreProducts } from "@/lib/supabaseStore";
import { resolveRequestHost } from "@/lib/vendorHost";
import { isMealItem } from "@/lib/biteraveClassification";

// Same menu-section order FoodDetailsSection.js's own dropdown uses in
// apps/dashboard, so a restaurant's menu reads top-to-bottom the way a
// real menu would rather than in arbitrary DB order.
const MENU_SECTION_ORDER = ["Starters", "Mains", "Sides", "Desserts", "Drinks"];
const FALLBACK_SECTION = "Menu";

// Matches proxy.js's own DELIVER_STATE_COOKIE name (stora_deliver_state).
const DELIVER_STATE_COOKIE = "stora_deliver_state";

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

  // Server-side read of the same cookie DeliveryStateContext.js/proxy.js
  // already maintain client-side -- this page is a Server Component, so
  // there's no client context to read it from instead.
  const cookieStore = await cookies();
  const deliveryState = cookieStore.get(DELIVER_STATE_COOKIE)?.value || null;
  const hasDeliveryMismatch =
    deliveryState && store.deliveryStates && store.deliveryStates.length > 0 && !store.deliveryStates.includes(deliveryState);

  return (
    <BiteraveAuthGateProvider>
    <div className="min-h-screen bg-gray-50">
      <SiteHeader brand="biterave" />

      <BiteraveRestaurantHero store={store} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {hasDeliveryMismatch && (
          <div className="mb-8 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{store.storeName}</span> delivers to{" "}
              {store.deliveryStates.length > 3
                ? `${store.deliveryStates.slice(0, 3).join(", ")} +${store.deliveryStates.length - 3} more`
                : store.deliveryStates.join(", ")}
              , not listed for {deliveryState}. Contact the vendor to confirm before ordering.
            </p>
          </div>
        )}

        <BiteraveStoreMenu storeSlug={store.storeSlug} menuSections={menuSections} groceries={groceries} />
      </div>

      <SiteFooter brand="biterave" />
    </div>
    </BiteraveAuthGateProvider>
  );
}
