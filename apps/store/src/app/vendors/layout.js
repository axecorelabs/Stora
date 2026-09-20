// page.js here is a client component ("use client", uses useSearchParams
// for the ?q=/?category=/?state= filters) -- a client component can't
// export generateMetadata/metadata itself, so this sibling layout (a
// server component by default) is what actually gives the route real
// metadata instead of silently falling through to the root layout's
// homepage title/description/canonical. alternates.canonical is a static
// clean path deliberately, not derived from the current query string, so
// every filter combination (?category=X&state=Y, ?mode=ai&q=...)
// canonicalizes to this one page rather than being indexed separately.
export const metadata = {
  title: "Discover Businesses",
  description:
    "Browse trusted businesses across Nigeria on Stora -- retail shops, restaurants, salons and barbers, photographers, tailors, home services, and more. Find and contact businesses near you.",
  alternates: {
    canonical: '/vendors',
  },
  openGraph: {
    title: "Discover Businesses | Stora",
    description: "Browse trusted businesses across Nigeria on Stora.",
    images: [
      {
        url: "/stora2.png",
        width: 1254,
        height: 1254,
        alt: "Stora - Nigeria's marketplace for businesses, products, and services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discover Businesses | Stora",
    description: "Browse trusted businesses across Nigeria on Stora.",
    images: ["/stora2.png"],
  },
};

export default function VendorsLayout({ children }) {
  return children;
}
