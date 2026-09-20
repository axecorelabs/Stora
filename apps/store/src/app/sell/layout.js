// Same reasoning as vendors/layout.js and products/layout.js -- page.js
// is a client component, so this sibling server layout is what actually
// gives the route real metadata instead of inheriting the homepage's.
export const metadata = {
  title: "List Your Business",
  description:
    "Get a business profile customers can find and contact -- gallery, price list, and direct WhatsApp/call/email buttons -- live on Stora from N500/month, no registered business required.",
  alternates: {
    canonical: '/sell',
  },
  openGraph: {
    title: "List Your Business | Stora",
    description: "Get a business profile customers can find and contact, live on Stora from N500/month.",
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
    title: "List Your Business | Stora",
    description: "Get a business profile customers can find and contact, live on Stora from N500/month.",
    images: ["/stora2.png"],
  },
};

export default function SellLayout({ children }) {
  return children;
}
