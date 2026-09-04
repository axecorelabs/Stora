import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { DeliveryStateProvider } from "@/contexts/DeliveryStateContext";
import QueryProvider from "@/providers/QueryProvider";
import GoogleAuthErrorBanner from "@/components/auth/GoogleAuthErrorBanner";
import LegalReviewGate from "@/components/auth/LegalReviewGate";
import NavigationLoadingOverlay from "@/components/ui/NavigationLoadingOverlay";
import Head from "next/head";

// Same pairing as apps/dashboard -- one typographic identity across both
// apps, not a second one invented for this app alone.
const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display-raw",
  subsets: ["latin"],
});

// Order numbers, SKUs, prices in a few places lean on font-mono for
// tabular alignment -- kept as its own face rather than folded into
// Inter's default figures.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://stora.com.ng"),
  title: "Stora Store",
  description: "Your marketplace ",
  openGraph: {
    title: "Stora Store",
    description: "Your marketplace ",
    images: [
      {
        url: "/stora2.png",
        width: 1254,
        height: 1254,
        alt: "Stora Store",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stora Store",
    description: "Your marketplace ",
    images: ["/stora2.png"],
  },
  icons: {
    icon: [
      {
        url: "/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />

      </Head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} bg-gray-50 text-gray-900 font-sans`}>
        <QueryProvider>
          <AuthProvider>
            <DeliveryStateProvider>
              <CartProvider>
                <GoogleAuthErrorBanner />
                <LegalReviewGate />
                <NavigationLoadingOverlay />
                {children}
              </CartProvider>
            </DeliveryStateProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
