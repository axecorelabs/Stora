import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import QueryProvider from "@/providers/QueryProvider";
import GoogleAuthErrorBanner from "@/components/auth/GoogleAuthErrorBanner";
import Head from "next/head";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
      <body className="bg-gray-50 text-gray-900">
        <QueryProvider>
          <AuthProvider>
            <CartProvider>
              <GoogleAuthErrorBanner />
              {children}
            </CartProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
