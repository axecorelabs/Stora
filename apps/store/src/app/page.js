"use client";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Lock, Headphones } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import AIHeroSearch from "@/components/home/AIHeroSearch";
import VendorShowcase from "@/components/home/VendorShowcase";
import CategoryDiscovery from "@/components/home/CategoryDiscovery";
import DiscoverySection from "@/components/home/DiscoverySection";
import CampaignsShowcase from "@/components/home/CampaignsShowcase";

// Plain, factual claims -- not "verified & reliable"/"only the best",
// which read as implicitly knocking some unnamed alternative rather than
// just stating what Stora offers.
const TRUST_BADGES = [
  { icon: ShieldCheck, label: "Verified vendors" },
  { icon: Lock, label: "Secure payments" },
  { icon: Headphones, label: "24/7 support" }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero -- light, content-sized rather than forced to a tall viewport
          fraction: white background (dark green now belongs to the trust
          badges band right below, not the hero itself) keeps this reading
          as a clean "first screen" that doesn't overstay its content. */}
      <section className="relative bg-white pt-10 sm:pt-14 pb-10 sm:pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <AIHeroSearch />

        {/* Wavy bottom edge, not a straight cut -- same technique as
            Biterave's own hero (apps/store/src/app/biterave/page.js), just
            colored to match the dark trust badges band right below instead
            of the white section that used to follow directly. */}
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full h-10 sm:h-16 text-brand-800"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0,40 C240,90 480,0 720,40 C960,80 1200,10 1440,50 L1440,100 L0,100 Z"
          />
        </svg>
      </section>

      {/* Trust badges -- one line each (icon + label, no subtitle), so the
          band reads as a quick reassurance strip rather than a second
          headline-sized block. */}
      <section className="bg-brand-800 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-1 sm:gap-6">
          {TRUST_BADGES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-1 sm:gap-2">
              <Icon className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px] text-gold-400 flex-shrink-0" strokeWidth={1.75} />
              <p className="text-white/90 text-[11px] sm:text-sm font-medium leading-tight whitespace-nowrap">{label}</p>
            </div>
          ))}
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

      {/* Browse by category / AI search */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Browse</p>
            <h2 className="font-display text-2xl font-bold text-brand-900">Shop by category</h2>
          </div>
          <CategoryDiscovery />
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

      {/* Campaigns/quizzes teaser -- owns its own visibility, renders
          nothing when there are no active campaigns (see the component). */}
      <CampaignsShowcase />

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
          <Link
            href="/sell"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold-500 text-brand-900 text-sm font-semibold hover:bg-gold-400 transition-colors"
          >
            Start selling
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
