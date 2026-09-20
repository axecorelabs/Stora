// Same reasoning as vendors/layout.js -- page.js is a client component,
// so this sibling server layout is what actually gives the route real
// metadata. Static canonical so every filter/search combination
// (?category=, ?q=, ?mode=ai) points back at this one clean page.
export const metadata = {
  title: "Shop Products",
  description:
    "Shop products from trusted businesses across Nigeria on Stora -- browse by category, search by what you need, and order directly from local vendors.",
  alternates: {
    canonical: '/products',
  },
  openGraph: {
    title: "Shop Products | Stora",
    description: "Shop products from trusted businesses across Nigeria on Stora.",
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
    title: "Shop Products | Stora",
    description: "Shop products from trusted businesses across Nigeria on Stora.",
    images: ["/stora2.png"],
  },
};

export default function ProductsLayout({ children }) {
  return children;
}
