import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata = {
  title: "Stora Admin",
  description: "Internal Stora staff tools -- partner vendors and marketing campaigns.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
