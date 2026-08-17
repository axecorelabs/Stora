import Link from "next/link";

// Shared across / and the dedicated /vendors, /products search pages.
export default function SiteFooter() {
  return (
    <footer className="py-10 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-display text-sm font-bold text-brand-800">stora</span>
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <Link href="/vendors" className="hover:text-brand-700 transition-colors">Vendors</Link>
          <Link href="/products" className="hover:text-brand-700 transition-colors">Products</Link>
          <Link href="/orders" className="hover:text-brand-700 transition-colors">Orders</Link>
          <Link href="/wishlist" className="hover:text-brand-700 transition-colors">Wishlist</Link>
          <a href="mailto:support@stora.com.ng" className="hover:text-brand-700 transition-colors">Support</a>
        </div>
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} Stora. All rights reserved.</p>
      </div>
    </footer>
  );
}
