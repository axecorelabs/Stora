"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Cross-link between the two dedicated search pages, carrying the current
// query term across -- typing "shirt" on /products and wanting to check
// whether a vendor named "Shirt Co" exists shouldn't mean retyping it.
export default function SearchModeTabs({ query }) {
  const pathname = usePathname();
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";

  const tabs = [
    { href: `/products${qs}`, label: "Products", match: "/products" },
    { href: `/vendors${qs}`, label: "Vendors", match: "/vendors" },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-gray-100 mb-6">
      {tabs.map((tab) => {
        const active = pathname === tab.match;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              active
                ? "border-brand-700 text-brand-800"
                : "border-transparent text-gray-500 hover:text-brand-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
