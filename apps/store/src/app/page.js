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
  { icon: ShieldCheck, title: "Verified vendors", subtitle: "Every seller is checked" },
  { icon: Lock, title: "Secure payments", subtitle: "Powered by Paystack" },
  { icon: Headphones, title: "24/7 support", subtitle: "We're always here to help" }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero -- light, content-sized rather than forced to a tall viewport
          fraction: white background (dark green now belongs to the trust
          badges band right below, not the hero itself) keeps this reading
          as a clean "first screen" that doesn't overstay its content. */}
      <section className="relative bg-white pt-10 sm:pt-14 pb-14 sm:pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <AIHeroSearch />

        {/* Curved bottom edge, not a straight cut -- a single smooth arc,
            not an undulating multi-crest wave (that read as busier than
            intended) -- colored to match the dark trust badges band right
            below instead of the white section that used to follow
            directly. */}
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full h-10 sm:h-16 text-brand-800"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0,40 Q720,100 1440,40 L1440,100 L0,100 Z"
          />
        </svg>
      </section>

      {/* Trust badges -- icon on top, then a bold title and a lighter
          subtitle line beneath it, so each badge reads as a small
          two-line statement rather than a single label. Waved on both
          edges now, not just the top (which only existed to close out the
          hero above it) -- a matching wave at the bottom transitions back
          into "Discover vendors" below, so the band reads as its own
          distinct shape rather than a flat rectangle with one decorated
          edge.
          The bottom wave is a normal-flow element (not absolutely
          positioned over the padding, like the hero's own wave is) --
          pt-10 above the badges and pb-10 below them are genuinely equal,
          and the wave then adds its own height purely on top of that
          instead of overlapping into the bottom padding. Absolute+overlap
          made the visible clearance below the text shrink to whatever the
          wave curve happened to leave at each point (as little as a few
          px at the curve's shallowest spots), which read as the text
          sitting noticeably closer to the bottom edge than the top --
          confirmed by measuring both paddings directly rather than just
          eyeballing it. */}
      <section className="relative bg-brand-800 pt-10 sm:pt-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl lg:max-w-4xl mx-auto grid grid-cols-3 gap-3 sm:gap-8 lg:gap-16 pb-10 sm:pb-14">
          {TRUST_BADGES.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex flex-col items-center text-center gap-1.5 sm:gap-2">
              <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-gold-400 flex-shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-white text-[11px] sm:text-base lg:text-lg font-semibold leading-tight">{title}</p>
                <p className="text-white/60 text-[10px] sm:text-sm leading-tight mt-0.5">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom curve -- the mirror image of the hero's own curve above
            (control point flipped to the opposite side), not a repeat of
            the same shape -- the two curves now bow away from each other
            instead of both sagging the same direction, so the band reads
            as one continuous lens/capsule shape rather than a hammock
            shifted down at its center. White to match "Discover vendors"
            right below (inherits the page wrapper's own bg-white). block,
            not absolute -- see the comment above the badges for why. */}
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          className="block w-full h-10 sm:h-16 text-white"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0,60 Q720,0 1440,60 L1440,100 L0,100 Z"
          />
        </svg>
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
