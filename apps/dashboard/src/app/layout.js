import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Providers } from "./providers";
import Head from "next/head";
import QueryProvider from "@/providers/QueryProvider";

// Same pairing and variable names as apps/store -- one typographic identity
// across both apps. Previously loaded via inter.className directly (rather
// than inter.variable, feeding globals.css's --font-sans mapping), and
// Space Grotesk's variable wasn't mapped into a --font-display *theme*
// token at all -- only usable via a raw inline style={{ fontFamily:
// "var(--font-display)" }}, and Tailwind's font-display utility (already
// used in CreateStoreModal.js) silently did nothing.
const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display-raw",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  metadataBase: new URL("https://app.stora.com.ng"),
  title: "Stora - Ecommerce Business Management System",
  description: "Professional business management system for businesses",
  openGraph: {
    title: "Stora - Ecommerce Business Management System",
    description: "Professional business management system for businesses",
    images: [
      {
        url: "/stora2.png",
        width: 1254,
        height: 1254,
        alt: "Stora",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stora - Ecommerce Business Management System",
    description: "Professional business management system for businesses",
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
    <html lang="en">
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
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} font-sans`}>
        <QueryProvider>
          <AuthProvider>
            <Providers>{children}</Providers>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
