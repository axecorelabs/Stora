import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowUpRight } from "lucide-react";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.stora.com.ng";

const LINK_GROUPS = [
  {
    heading: "Shop",
    links: [
      { label: "All vendors", href: "/vendors" },
      { label: "All products", href: "/products" },
    ],
  },
  {
    heading: "Your account",
    links: [
      { label: "Orders", href: "/orders" },
      { label: "Wishlist", href: "/wishlist" },
      { label: "Cart", href: "/cart" },
    ],
  },
];

// Shared across / and the dedicated /vendors, /products search pages.
// Deliberately the platform's own dark-green anchor -- distinct from the
// blurred brand-800 header -- so the page has a clear floor, with the
// same gold-to-green gradient used on the search capsule as a hairline
// top edge, tying the two together as one signature rather than two
// unrelated brand touches.
export default function SiteFooter() {
  return (
    <footer className="relative bg-brand-900">
      <div
        className="h-[3px] w-full"
        style={{
          background: "linear-gradient(90deg, #D8BC85 0%, #145C41 50%, #D8BC85 100%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="lg:col-span-5">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/stora-icon.png" alt="" width={24} height={28} className="h-7 w-auto" />
              <span className="font-display text-2xl font-bold text-white tracking-tight">stora</span>
            </Link>
            <p className="mt-3 text-sm text-white/60 leading-relaxed max-w-xs">
              A marketplace for Nigeria&apos;s independent vendors -- browse hundreds of
              stores and shop them all in one place.
            </p>
            <a
              href="mailto:support@stora.com.ng"
              className="mt-5 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              <Mail className="w-4 h-4 text-gold-400" />
              support@stora.com.ng
            </a>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.heading} className="lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">
                {group.heading}
              </p>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-white/70 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="lg:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">For vendors</p>
            <p className="text-sm text-white/60 leading-relaxed mb-4">
              Set up your own store on Stora and reach buyers across Nigeria.
            </p>
            <a
              href={DASHBOARD_URL}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-300 transition-colors"
            >
              Sell on Stora
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">© {new Date().getFullYear()} Stora. All rights reserved.</p>
          <p className="text-xs text-white/40">Made for Nigerian vendors and the people who shop with them.</p>
        </div>
      </div>
    </footer>
  );
}
