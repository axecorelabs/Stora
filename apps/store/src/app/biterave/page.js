import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, UtensilsCrossed, ShoppingBasket } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import RestaurantCard from "@/components/biterave/RestaurantCard";
import FoodItemCard from "@/components/biterave/FoodItemCard";
import BiteraveAuthGateProvider from "@/components/biterave/BiteraveAuthGateProvider";
import { searchBiteraveVendors, searchBiteraveProducts } from "@/lib/supabaseStore";
import { resolveRequestHost } from "@/lib/vendorHost";

// A curated teaser, the same relationship the main homepage
// (apps/store/src/app/page.js) has to /products and /vendors -- small,
// fixed-size previews linking into the real, fully paginated/searchable
// pages (/biterave/meals, /groceries, /restaurants, /groceries/vendors),
// rather than being the whole browsing experience itself. Real search/
// pagination lives entirely in those dedicated pages now.
// Promise.allSettled, not Promise.all -- a transient backend hiccup on
// ANY one of these four independent teaser queries must not crash the
// whole landing page (confirmed live: a momentary Supabase connection
// blip 500'd the entire page when this was Promise.all). Each section
// already has its own "nothing here yet" empty state, so degrading a
// failed section to an empty array is a real, working fallback, not a
// placeholder -- same fail-open discipline /api/search/ai already applies
// to its own backend calls.
async function loadTeaserData() {
  const results = await Promise.allSettled([
    searchBiteraveVendors({ mealOnly: true, limit: 3, sort: "featured" }),
    searchBiteraveVendors({ mealOnly: false, limit: 3, sort: "featured" }),
    searchBiteraveProducts({ mealOnly: true, limit: 8, sort: "trending" }),
    searchBiteraveProducts({ mealOnly: false, limit: 8, sort: "trending" })
  ]);
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Error loading Biterave landing teaser section ${i}:`, result.reason);
    }
  });
  const [restaurantsResult, groceryVendorsResult, mealsResult, groceriesResult] = results;
  return {
    restaurants: restaurantsResult.status === "fulfilled" ? restaurantsResult.value.vendors : [],
    groceryVendors: groceryVendorsResult.status === "fulfilled" ? groceryVendorsResult.value.vendors : [],
    meals: mealsResult.status === "fulfilled" ? mealsResult.value.products : [],
    groceries: groceriesResult.status === "fulfilled" ? groceriesResult.value.products : []
  };
}

// Host-aware so a link shared from biterave.stora.com.ng (or, once
// registered, the standalone Biterave domain) produces OG/Twitter tags
// pointing at the SAME host the visitor is actually on.
export async function generateMetadata() {
  const hdrs = await headers();
  const host = resolveRequestHost({ headers: hdrs }) || "biterave.stora.com.ng";
  const url = `https://${host}/`;
  const title = "Biterave - Order meals or shop groceries from vendors near you";
  const description = "Real dishes from real restaurants, and real groceries from real vendors, all in one place.";
  const image = "/og-image.jpg";

  return {
    title,
    description,
    openGraph: { title, description, url, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function BiteravePage() {
  const { restaurants, groceryVendors, meals, groceries } = await loadTeaserData();

  return (
    <BiteraveAuthGateProvider>
    <div className="min-h-screen bg-gray-50">
      <SiteHeader brand="biterave" />

      <section className="relative bg-brand-800 pt-14 pb-20 sm:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Biterave
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-white leading-tight mb-4">
            Craving a meal, or restocking the kitchen?
          </h1>
          <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto mb-8">
            Order from restaurants and home kitchens, or shop groceries from real vendors -- all in one cart.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/biterave/meals"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-brand-900 text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              <UtensilsCrossed className="w-4 h-4" /> Order a meal
            </Link>
            <Link
              href="/biterave/groceries"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-600 transition-colors border border-white/10"
            >
              <ShoppingBasket className="w-4 h-4" /> Shop groceries
            </Link>
          </div>
        </div>

        {/* Wavy bottom edge, not a straight cut -- the light color (matching
            this page's own bg-gray-50) sits on top of the green rectangle,
            so the curve is what actually reads as the section boundary. */}
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full h-10 sm:h-16 text-gray-50"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0,40 C240,90 480,0 720,40 C960,80 1200,10 1440,50 L1440,100 L0,100 Z"
          />
        </svg>
      </section>

      <section className="py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Browse</p>
              <h2 className="font-display text-2xl font-bold text-brand-900">Restaurants on Biterave</h2>
            </div>
            <Link href="/biterave/restaurants" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 shrink-0">
              See all restaurants <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {restaurants.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">No restaurants yet -- check back soon.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible">
              {restaurants.map((store) => <RestaurantCard key={store.id} store={store} />)}
            </div>
          )}
          <div className="mt-6 flex justify-center sm:hidden">
            <Link href="/biterave/restaurants" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800">
              See all restaurants <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-brand-50/40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Discover</p>
              <h2 className="font-display text-2xl font-bold text-brand-900">Dishes worth trying</h2>
            </div>
            <Link href="/biterave/meals" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 shrink-0">
              See all meals <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {meals.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">Nothing to show yet -- check back soon.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {meals.map((product) => (
                <FoodItemCard key={product.id} product={product} storeSlug={product.store?.storeSlug} storeName={product.store?.storeName} />
              ))}
            </div>
          )}
          <div className="mt-6 flex justify-center sm:hidden">
            <Link href="/biterave/meals" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800">
              See all meals <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Browse</p>
              <h2 className="font-display text-2xl font-bold text-brand-900">Grocery vendors on Biterave</h2>
            </div>
            <Link href="/biterave/groceries/vendors" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 shrink-0">
              See all grocery vendors <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {groceryVendors.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">No grocery vendors yet -- check back soon.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible">
              {groceryVendors.map((store) => <RestaurantCard key={store.id} store={store} />)}
            </div>
          )}
          <div className="mt-6 flex justify-center sm:hidden">
            <Link href="/biterave/groceries/vendors" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800">
              See all grocery vendors <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-brand-50/40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Discover</p>
              <h2 className="font-display text-2xl font-bold text-brand-900">Groceries worth stocking up on</h2>
            </div>
            <Link href="/biterave/groceries" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 shrink-0">
              See all groceries <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {groceries.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">Nothing to show yet -- check back soon.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {groceries.map((product) => (
                <FoodItemCard key={product.id} product={product} storeSlug={product.store?.storeSlug} storeName={product.store?.storeName} />
              ))}
            </div>
          )}
          <div className="mt-6 flex justify-center sm:hidden">
            <Link href="/biterave/groceries" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800">
              See all groceries <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter brand="biterave" />
    </div>
    </BiteraveAuthGateProvider>
  );
}
