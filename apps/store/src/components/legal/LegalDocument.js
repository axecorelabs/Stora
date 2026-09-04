import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";

// Shared shell for every legal page (/terms, /privacy, /refund-policy,
// /delivery-policy) -- plain semantic HTML (h2/h3/p/ul/table) styled via
// child-selector utilities on the wrapper instead of a className on every
// single tag, so each page's own JSX stays close to the source documents
// in /legal at the repo root.
export default function LegalDocument({ title, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-900">{title}</h1>
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
            [&>table]:w-full [&>table]:text-xs [&>table]:sm:text-sm [&>table]:border-collapse [&>table]:mb-6
            [&_th]:text-left [&_th]:border-b [&_th]:border-gray-200 [&_th]:py-2 [&_th]:pr-3 [&_th]:font-semibold [&_th]:text-gray-900
            [&_td]:border-b [&_td]:border-gray-100 [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td]:text-gray-700
            [&>hr]:my-10 [&>hr]:border-gray-200
            [&>p:last-child]:text-xs [&>p:last-child]:text-gray-400 [&>p:last-child]:italic
          "
        >
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
