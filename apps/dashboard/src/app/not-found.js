import Link from "next/link";
import { Home } from "lucide-react";

export const metadata = {
  title: "Page not found - Stora",
};

// Standalone, like reset-password's page -- deliberately not wrapped in
// DashboardLayout, which redirects unauthenticated visitors to "/" on
// mount. A 404 has to render as-is for anyone who lands on a dead link,
// signed in or not.
export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center animate-rise-in">
        <div className="w-14 h-14 mx-auto mb-6 rounded-xl overflow-hidden">
          <img src="/stora.png" alt="Stora Logo" className="object-contain w-full h-full" />
        </div>

        <p
          className="text-7xl font-bold text-brand-800 leading-none tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          404
        </p>

        <h1
          className="mt-4 text-xl font-bold text-gray-900 tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          This page doesn&apos;t exist
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          The page you&apos;re looking for may have been moved, renamed, or never existed.
        </p>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-800 text-white text-sm font-medium hover:bg-brand-900 transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
