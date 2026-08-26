import Link from "next/link";
import { Compass } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import HeroSearch from "@/components/home/HeroSearch";

export const metadata = {
  title: "Page not found - Stora",
};

// Full site chrome (header/footer) stays in place, and the 404 itself
// mirrors the homepage hero -- so a broken link doesn't strand a shopper,
// it just drops them into the same search they'd use to find what they
// actually wanted.
export default function NotFound() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="bg-brand-800 pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-display text-7xl sm:text-8xl font-bold text-gold-400 leading-none mb-4">
            404
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-3">
            We can&apos;t find that page
          </h1>
          <p className="text-white/60 text-base mb-8 max-w-md mx-auto">
            The link might be broken, or the page may have moved. Try searching for what you were after.
          </p>

          <div className="flex justify-center mb-6">
            <HeroSearch />
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white transition-colors"
          >
            <Compass className="w-4 h-4" />
            Back to homepage
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
