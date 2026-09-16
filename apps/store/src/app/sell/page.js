"use client";
import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Store,
  LayoutList,
  Package,
  Wallet,
  Truck,
  CreditCard,
  MessageCircle,
  UtensilsCrossed,
  Globe,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.stora.com.ng";
const STORE_SIGNUP_URL = `${DASHBOARD_URL}?mode=signup&intent=store`;
const LISTING_SIGNUP_URL = `${DASHBOARD_URL}?mode=signup&intent=listing`;

const STEPS = [
  {
    number: "01",
    title: "Create your store",
    body: "Sign up, name your store and drop in your own logo and colors. No registered business or existing website required.",
  },
  {
    number: "02",
    title: "List what you sell",
    body: "Add products, set your own prices, and track stock across variants. Selling food? Switch on Restaurant Mode for priced extras and made-to-order items.",
  },
  {
    number: "03",
    title: "Get paid, order by order",
    body: "Customers pay by card, transfer or USSD through Paystack, which settles to your bank account, or order over WhatsApp if you're not ready to take card payments yet.",
  },
];

const FEATURES = [
  {
    icon: Store,
    title: "A storefront that's yours",
    body: "Your own page on Stora with your name, logo and brand colors -- not a listing buried inside someone else's catalogue.",
  },
  {
    icon: Package,
    title: "Inventory that keeps up",
    body: "Track stock across variants and batches, so you're never confirming an order you can't fulfil.",
  },
  {
    icon: Wallet,
    title: "Paid straight to your bank",
    body: "Every online sale settles through Paystack to your bank account, with a clear record of what you earned and when.",
  },
  {
    icon: Truck,
    title: "Delivery, sorted by state",
    body: "Set the states you deliver to, and customers can filter by location before they ever land on your store.",
  },
  {
    icon: CreditCard,
    title: "A till for walk-in customers",
    body: "Ring up in-person sales with POS, on the same inventory as your online store -- nothing to reconcile by hand.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp orders, no card required",
    body: "Not ready to take card payments? Customers can still find you, order, and pay you directly over WhatsApp.",
  },
  {
    icon: UtensilsCrossed,
    title: "Built for food vendors too",
    body: "Restaurant Mode adds priced extras and per-item customization -- shawarma with extra sausage, correctly priced, sorted.",
  },
  {
    icon: Globe,
    title: "Found by people looking to buy",
    body: "Show up in Stora's marketplace search, so people already looking for what you sell can find you.",
  },
  {
    icon: ShieldCheck,
    title: "A Verified badge buyers can see",
    body: "Verify your identity with your NIN -- no registered business needed -- and earn a Verified badge on your store, free for every vendor.",
  },
];

const FAQS = [
  {
    q: "Do I need a registered business or my own website to start?",
    a: "No. You can start selling with just your name, a phone number and what you're selling -- no registered business and no existing website required.",
  },
  {
    q: "What does it cost to sell on Stora?",
    a: "Sell on Stora is ₦3,500/month plus 2% commission on completed sales. Business Listing is a separate option at ₦500/month for discoverability-only businesses.",
  },
  {
    q: "How and when do I get paid?",
    a: "Orders paid by card, transfer or USSD go through Paystack, which settles to your bank account. If you'd rather collect payment yourself, customers can also order and pay you directly over WhatsApp.",
  },
  {
    q: "Do I need to verify my identity to sell?",
    a: "No, it's optional -- but every vendor can verify their identity with their NIN, free of charge, and earn a Verified badge that helps buyers trust your store.",
  },
  {
    q: "Can I sell food or made-to-order items?",
    a: "Yes -- switch on Restaurant Mode to add priced, limited extras and per-item customization for food and made-to-order menus.",
  },
  {
    q: "Can I still sell to people in person?",
    a: "Yes. POS lets you ring up walk-in customers on the same inventory as your online store, so stock never falls out of sync.",
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
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">For vendors</p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-white leading-tight mb-5 text-balance">
              Bring your own brand.
              <br />
              We&apos;ll bring everything else.
            </h1>
            <p className="text-white/60 text-base sm:text-lg mb-8 max-w-xl mx-auto lg:mx-0">
              Grow visibility, build trust, and turn discovery into customers. Start with a business listing,
              then upgrade to full selling tools when you are ready to take online orders.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <a
                href={STORE_SIGNUP_URL}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gold-500 text-brand-900 text-sm font-semibold hover:bg-gold-400 transition-colors"
              >
                Start selling
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href={LISTING_SIGNUP_URL}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-brand-900 text-sm font-semibold hover:bg-gold-50 transition-colors"
              >
                List my business
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
                  <li>Show credibility with a polished profile, gallery, and clear service details</li>
                  <li>Upgrade anytime to full checkout, payments, and inventory tools</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value proposition first */}
      <section id="value" className="py-14 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Value first</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 text-balance">
              Why listing on Stora is valuable
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-gray-100 p-6 bg-brand-50/40 md:col-span-2">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center mb-4">
                <Store className="w-5 h-5 text-brand-700" />
              </div>
              <h3 className="font-display text-lg font-semibold text-brand-900 mb-2">Sell on Stora</h3>
              <p className="text-sm text-gray-600 mb-4">For businesses that want to sell products or services, accept orders online, and run operations from one dashboard.</p>
              <ul className="text-sm text-gray-600 space-y-1.5 mb-5">
                <li>Storefront with checkout and order management</li>
                <li>Inventory, POS, and delivery-state controls</li>
                <li>Scale from profile-only discovery to full commerce when you are ready</li>
              </ul>
              <a
                href={STORE_SIGNUP_URL}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
              >
                Start selling
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="rounded-2xl border border-gray-100 p-6 bg-white">
              <div className="w-10 h-10 rounded-xl bg-gold-500/15 flex items-center justify-center mb-4">
                <LayoutList className="w-5 h-5 text-gold-700" />
              </div>
              <h3 className="font-display text-lg font-semibold text-brand-900 mb-2">List My Business</h3>
              <p className="text-sm text-gray-600 mb-4">For businesses focused on discoverability and direct customer inquiries.</p>
              <ul className="text-sm text-gray-600 space-y-1.5 mb-5">
                <li>Public business profile with gallery and contact actions</li>
                <li>Appear in business directory and AI-assisted vendor search</li>
                <li>Get found by customers already looking for what you offer</li>
              </ul>
              <a
                href={LISTING_SIGNUP_URL}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gold-400/50 text-gold-700 text-sm font-semibold hover:bg-gold-500/10 transition-colors"
              >
                Create business listing
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">How it works</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 text-balance">
              Three steps from idea to first sale
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
              Everything you need to run a real store
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
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 mb-1.5">Pricing</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 mb-3 text-balance">
            Start with listing, upgrade to full selling
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mb-8 max-w-xl mx-auto">
            Choose the level that matches where your business is now.
          </p>

          <div className="grid md:grid-cols-2 gap-4 text-left mb-8">
            <div className="rounded-2xl border border-gold-200 bg-gold-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-700 mb-2">Business listing pricing</p>
              <p className="font-display text-4xl font-bold text-gold-900 mb-1">₦500<span className="text-base font-medium">/month</span></p>
              <p className="text-sm text-gold-900">For discoverability-focused businesses that want a profile, gallery, and direct customer contact options.</p>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-brand-800 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-300 mb-2">Sell on Stora pricing</p>
              <p className="font-display text-4xl font-bold mb-1">₦3,500<span className="text-base font-medium text-white/70">/month</span></p>
              <p className="text-sm text-white/80">Plus 2% commission per completed sale, with full checkout, inventory, POS, and order operations.</p>
            </div>
          </div>

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
            Ready to open your store?
          </h2>
          <p className="text-white/60 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            It takes a few minutes to set up -- no business registration required, and no setup cost.
          </p>
          <a
            href={STORE_SIGNUP_URL}
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
