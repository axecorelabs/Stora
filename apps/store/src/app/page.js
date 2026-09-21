"use client";
import Link from "next/link";
import { ArrowRight, LayoutList, Camera, MessageCircle, Search } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import AIHeroSearch from "@/components/home/AIHeroSearch";
import VendorShowcase from "@/components/home/VendorShowcase";
import CategoryDiscovery from "@/components/home/CategoryDiscovery";
import DiscoverySection from "@/components/home/DiscoverySection";
import CampaignsShowcase from "@/components/home/CampaignsShowcase";

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Stora",
  url: "https://stora.com.ng",
  logo: "https://stora.com.ng/stora2.png",
  sameAs: [],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Stora",
  url: "https://stora.com.ng",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://stora.com.ng/vendors?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.stora.com.ng";
const LISTING_SIGNUP_URL = `${DASHBOARD_URL}?mode=signup&intent=listing`;

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }} />
      <SiteHeader />

      {/* Hero -- green backdrop with a waved handoff into the sections below. */}
      <section className="relative pt-10 sm:pt-14 pb-14 sm:pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/IMG_6315%202.webp')" }}
          />
          <div className="absolute inset-0 bg-brand-900/62" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-900/52 via-brand-800/66 to-brand-900/78" />
        </div>

        <div className="relative z-10">
          <AIHeroSearch />
        </div>

        {/* Bottom wave into the white section below, same visual style as Biterave. */}
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          className="absolute z-10 bottom-0 left-0 w-full h-10 sm:h-16 text-white"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0,40 C240,90 480,0 720,40 C960,80 1200,10 1440,50 L1440,100 L0,100 Z"
          />
        </svg>
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

      {/* Discover businesses */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Discover</p>
              <h2 className="font-display text-2xl font-bold text-brand-900">Businesses on Stora</h2>
            </div>
            <Link
              href="/vendors"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors shrink-0"
            >
              See all businesses
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <VendorShowcase />
          <div className="mt-6 flex justify-center sm:hidden">
            <Link
              href="/vendors"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
            >
              See all businesses
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

      {/* Campaigns/quizzes teaser -- owns its own visibility, renders
          nothing when there are no active campaigns (see the component). */}
      <CampaignsShowcase />

      {/* List Your Business */}
      <section className="border-t-2 border-gold-500 bg-brand-800 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-1.5">For businesses</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-4 text-balance">
            Get found by customers already looking for you
          </h2>
          <p className="text-white/60 text-sm sm:text-base mb-9 max-w-xl mx-auto">
            A business listing gets you a profile with your photos, services, and contact details --
            live on Stora in minutes, no registered business or website required.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 text-left mb-9">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="w-9 h-9 rounded-lg bg-gold-500/20 flex items-center justify-center mb-3">
                <Camera className="w-5 h-5 text-gold-300" />
              </div>
              <h3 className="font-display text-sm font-semibold text-white mb-1">Show your work</h3>
              <p className="text-sm text-white/60">A gallery and price list that show customers what you offer before they even reach out.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="w-9 h-9 rounded-lg bg-gold-500/20 flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-gold-300" />
              </div>
              <h3 className="font-display text-sm font-semibold text-white mb-1">Turn up in search</h3>
              <p className="text-sm text-white/60">Listed in Stora&apos;s directory and AI-powered search, by category and city.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="w-9 h-9 rounded-lg bg-gold-500/20 flex items-center justify-center mb-3">
                <MessageCircle className="w-5 h-5 text-gold-300" />
              </div>
              <h3 className="font-display text-sm font-semibold text-white mb-1">Get contacted directly</h3>
              <p className="text-sm text-white/60">WhatsApp, call, or email buttons right on your profile -- no back-and-forth required.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={LISTING_SIGNUP_URL}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gold-500 text-brand-900 text-sm font-semibold hover:bg-gold-400 transition-colors"
            >
              <LayoutList className="w-4 h-4" />
              List your business
            </a>
            <Link
              href="/sell"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white hover:text-gold-200 transition-colors"
            >
              See what&apos;s included
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
