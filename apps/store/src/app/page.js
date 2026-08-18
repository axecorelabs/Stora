"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import HeroSearch from "@/components/home/HeroSearch";
import VendorShowcase from "@/components/home/VendorShowcase";
import DiscoverySection from "@/components/home/DiscoverySection";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.stora.com.ng";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero */}
      <section className="bg-brand-800 pt-14 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-white leading-tight mb-5">
            Real vendors. Real products.
            <br />
            One place to find them.
          </h1>
          <p className="text-white/60 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Stora brings together independent Nigerian sellers you can actually trust --
            browse, order, and pay knowing exactly who you&apos;re buying from.
          </p>
          <div className="flex justify-center">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* Discover vendors */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Discover</p>
              <h2 className="font-display text-2xl font-bold text-brand-900">Vendors on Stora</h2>
            </div>
            <Link
              href="/vendors"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors shrink-0"
            >
              See all vendors
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <VendorShowcase />
          <div className="mt-6 flex justify-center sm:hidden">
            <Link
              href="/vendors"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
            >
              See all vendors
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Discover products */}
      <section id="discover" className="py-16 px-4 sm:px-6 lg:px-8 bg-brand-50/40 scroll-mt-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Discover</p>
            <h2 className="font-display text-2xl font-bold text-brand-900">Products worth a look</h2>
          </div>
          <DiscoverySection />
        </div>
      </section>

      {/* Sell on Stora */}
      <section className="border-t-2 border-gold-500 bg-brand-800 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-1.5">For vendors</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-4">
            Bring your own brand. We bring the infrastructure.
          </h2>
          <p className="text-white/60 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            Keep your own storefront, your own colors, your own customers -- Stora handles
            payments, order tracking, and getting found.
          </p>
          <a
            href={DASHBOARD_URL}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold-500 text-brand-900 text-sm font-semibold hover:bg-gold-400 transition-colors"
          >
            Start selling
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
