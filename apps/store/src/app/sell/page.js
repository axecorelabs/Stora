"use client";
import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Store,
  Images,
  MessageCircle,
  Search,
  ShieldCheck,
  MapPin,
  Wallet,
  Star,
  LayoutList,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.stora.com.ng";
const LISTING_SIGNUP_URL = `${DASHBOARD_URL}?mode=signup&intent=listing`;

const STEPS = [
  {
    number: "01",
    title: "Create your business profile",
    body: "Sign up, name your business, pick your category, and drop in your own logo and colors. No registered business or existing website required.",
  },
  {
    number: "02",
    title: "Add your photos and price list",
    body: "Show what you offer with a gallery of up to 10 photos and a clear price list, so customers already know before they reach out.",
  },
  {
    number: "03",
    title: "Get discovered and contacted",
    body: "Show up in Stora's directory and AI-powered search, and let customers reach you directly by WhatsApp, call, or email.",
  },
];

const FEATURES = [
  {
    icon: Store,
    title: "A profile that's yours",
    body: "Your own page on Stora with your name, logo and brand colors -- not a listing buried inside someone else's catalogue.",
  },
  {
    icon: Images,
    title: "A gallery that shows your work",
    body: "Up to 10 photos so customers see what you do before they ever call.",
  },
  {
    icon: MessageCircle,
    title: "Direct contact, no middleman",
    body: "WhatsApp, phone and email buttons right on your profile -- customers reach you straight, no app or account needed on their end.",
  },
  {
    icon: Search,
    title: "Found by people looking to buy",
    body: "Show up in Stora's directory and AI-powered search, matched by category and city -- even when they don't know your business name yet.",
  },
  {
    icon: Wallet,
    title: "A price list, not a guessing game",
    body: "List your services and prices upfront, so customers arrive already informed instead of asking \"how much?\" first.",
  },
  {
    icon: MapPin,
    title: "Your location and hours, clear upfront",
    body: "A map preview and business hours on your profile, so people know exactly where and when to find you.",
  },
  {
    icon: Star,
    title: "Reviews that build trust",
    body: "Customers who've used your business can leave a review right on your profile.",
  },
  {
    icon: ShieldCheck,
    title: "A Verified badge buyers can see",
    body: "Verify your identity with your NIN -- no registered business needed -- and earn a Verified badge, free for every business.",
  },
  {
    icon: LayoutList,
    title: "Every kind of business welcome",
    body: "Retail, restaurants, salons and barbers, photographers, tailors, event and catering services, home and repair trades, real estate, and more.",
  },
];

const FAQS = [
  {
    q: "Do I need a registered business or my own website to list?",
    a: "No. You can create a business listing with just your name, a phone number and what you do -- no registered business and no existing website required.",
  },
  {
    q: "What does it cost?",
    a: "A business listing is ₦500/month, with no setup fee. Cancel your subscription anytime.",
  },
  {
    q: "How do customers actually reach me?",
    a: "Through WhatsApp, call, or email buttons right on your profile -- there's no back-and-forth or app your customers need to install.",
  },
  {
    q: "What kind of businesses can list on Stora?",
    a: "A wide range -- retail shops, restaurants, salons and barbers, photographers, tailors, event and catering services, home and repair trades, real estate, and more.",
  },
  {
    q: "Do I need to verify my identity to list my business?",
    a: "No, it's optional -- but every business can verify with their NIN, free of charge, and earn a Verified badge that helps buyers trust your profile.",
  },
  {
    q: "Can I sell products or take orders online later?",
    a: "Yes -- once you're set up on Stora, you can upgrade to full commerce tools (storefront, checkout, inventory, and POS) anytime from your dashboard, whenever you're ready.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-semibold text-gray-900 text-sm sm:text-base">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <p className="pb-5 text-sm text-gray-500 leading-relaxed pr-8">{a}</p>}
    </div>
  );
}

export default function SellOnStoraPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero */}
      <section className="bg-brand-800 pt-16 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">For businesses</p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-white leading-tight mb-5 text-balance">
              Your business,
              <br />
              one search away.
            </h1>
            <p className="text-white/60 text-base sm:text-lg mb-8 max-w-xl mx-auto lg:mx-0">
              A Stora business listing gets you a real online presence -- gallery, price list, and direct
              contact buttons -- so customers can find and reach you today, not eventually.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <a
                href={LISTING_SIGNUP_URL}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gold-500 text-brand-900 text-sm font-semibold hover:bg-gold-400 transition-colors"
              >
                List your business -- ₦500/month
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#value"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
              >
                See why it works
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-xs">
              <div className="absolute -inset-6 rounded-[2rem] bg-gold-500/10 blur-2xl" aria-hidden="true" />
              <div className="relative bg-white rounded-3xl border border-white/10 shadow-2xl p-8 text-left">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-3">Why businesses choose Stora</p>
                <ul className="space-y-2.5 text-sm text-gray-600">
                  <li>Get discovered by customers searching in your city and category</li>
                  <li>Show credibility with a polished profile, gallery, and clear price list</li>
                  <li>Reachable by WhatsApp, call, or email -- no app required for customers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value proposition first */}
      <section id="value" className="py-14 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Built for businesses like yours</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 text-balance">
              Whatever you do, there&apos;s room for it on Stora
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "Retail & shops", body: "Supermarkets, boutiques, electronics, pharmacies, and more." },
              { title: "Restaurants & food", body: "Kitchens, bakeries, cafes, grills, and drink spots." },
              { title: "Salons & beauty", body: "Salons, barbers, and beauty and wellness services." },
              { title: "Photography & events", body: "Photographers, videographers, caterers, and event planners." },
              { title: "Home & repair trades", body: "Electricians, plumbers, mechanics, and tech repair." },
              { title: "Professional services", body: "Tailors, real estate, security, cleaning, and more." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-100 p-5 bg-brand-50/40">
                <h3 className="font-display text-sm font-semibold text-brand-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">How it works</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 text-balance">
              Three steps from idea to first contact
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
            {STEPS.map((step) => (
              <div key={step.number} className="relative">
                <p className="font-display text-4xl font-bold text-brand-100 mb-3 tabular-nums">{step.number}</p>
                <h3 className="font-display text-lg font-semibold text-brand-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-brand-50/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">What&apos;s included</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 text-balance">
              Everything you need to be found and reached
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-brand-700" strokeWidth={1.75} />
                </div>
                <h3 className="font-display text-base font-semibold text-brand-900 mb-1.5">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Pricing</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 mb-3 text-balance">
            One simple price
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mb-8 max-w-xl mx-auto">
            No listing or setup fees, and no commitment beyond the month.
          </p>

          <a
            href={LISTING_SIGNUP_URL}
            className="block rounded-2xl border border-gold-200 bg-gold-50 p-8 text-left hover:border-gold-300 hover:shadow-sm transition-all mb-8"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-700 mb-2">Business listing</p>
            <p className="font-display text-5xl font-bold text-gold-900 mb-1">₦500<span className="text-base font-medium">/month</span></p>
            <p className="text-sm text-gold-900 mt-3">Profile, gallery, price list, contact buttons, and full search visibility -- everything on this page.</p>
            <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-800">
              List your business
              <ArrowRight className="w-4 h-4" />
            </p>
          </a>

          <p className="text-sm text-gray-500 mb-8">
            Ready to sell products or take orders online? Upgrade to full commerce tools -- storefront,
            checkout, inventory, and POS -- anytime from your dashboard once you&apos;re set up.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 text-left">
            {[
              "No listing or setup fees",
              "Cancel your subscription anytime",
              "Free identity verification, always",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5 bg-brand-50/60 rounded-xl p-4">
                <CheckCircle2 className="w-5 h-5 text-brand-700 flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-brand-900">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-brand-50/40">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Questions</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-900">Before you get started</h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-6">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t-2 border-gold-500 bg-brand-800 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-5">
            <Image src="/stora-icon.png" alt="" width={24} height={28} className="h-7 w-auto" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-4 text-balance">
            Ready to be found?
          </h2>
          <p className="text-white/60 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            It takes a few minutes to set up -- no business registration required, and no setup cost.
          </p>
          <a
            href={LISTING_SIGNUP_URL}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold-500 text-brand-900 text-sm font-semibold hover:bg-gold-400 transition-colors"
          >
            List your business
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
