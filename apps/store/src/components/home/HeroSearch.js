"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

// Sends the visitor to the real, paginated /products search page rather
// than re-filtering the small homepage teaser grid in place -- a proper
// search page is what "search for products" needs to mean once the
// catalog is thousands of items, not a dozen.
export default function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-900/40" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search for products or vendors"
          className="w-full pl-11 pr-28 py-3.5 rounded-xl bg-white text-sm text-brand-900 placeholder:text-brand-900/40 focus:outline-none focus:ring-2 focus:ring-gold-500"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1.5 bottom-1.5 px-5 rounded-lg bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  );
}
