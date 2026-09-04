import Link from "next/link";

// Dashboard has no marketing chrome like the store app's SiteHeader/
// SiteFooter -- its only public-facing surface before this was the auth
// page itself, so this is a minimal standalone shell: a small wordmark
// linking back to sign-in/sign-up, the document, and a plain footer.
// Styling mirrors this app's existing brand tokens (see globals.css'
// --color-brand-* scale), same as apps/store's equivalent component.
export default function LegalDocument({ title, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <Link href="/" className="font-display text-lg font-bold text-brand-900" style={{ fontFamily: "var(--font-display)" }}>
            Stora
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-900" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h1>
        <p className="text-sm text-gray-400 mt-2 mb-10">Last updated: {lastUpdated}</p>
        <div
          className="
            [&>h2]:font-display [&>h2]:text-lg [&>h2]:sm:text-xl [&>h2]:font-bold [&>h2]:text-brand-900 [&>h2]:mt-10 [&>h2]:mb-3 [&>h2]:first:mt-0
            [&>h3]:font-display [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-brand-900 [&>h3]:mt-6 [&>h3]:mb-2
            [&>p]:text-sm [&>p]:sm:text-base [&>p]:text-gray-700 [&>p]:leading-relaxed [&>p]:mb-4
            [&_a]:text-brand-700 [&_a]:underline [&_a]:hover:text-brand-800
            [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-2 [&>ul]:mb-4 [&>ul]:text-sm [&>ul]:sm:text-base [&>ul]:text-gray-700
            [&_strong]:font-semibold [&_strong]:text-gray-900
            [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:font-mono
            [&>hr]:my-10 [&>hr]:border-gray-200
            [&>p:last-child]:text-xs [&>p:last-child]:text-gray-400 [&>p:last-child]:italic
          "
        >
          {children}
        </div>
      </div>

      <footer className="border-t border-gray-100 py-8">
        <p className="text-center text-xs text-gray-400">© {new Date().getFullYear()} Axecore Labs Limited. All rights reserved.</p>
      </footer>
    </div>
  );
}
