"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";

const SIDEBAR_COLLAPSED_KEY = "stora-admin-sidebar-collapsed";

function getInitialCollapsedState() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

// Same shell as apps/dashboard's own DashboardLayout.js -- sidebar +
// fixed header + content column -- plus the auth redirect RequireAuth.js
// used to do on its own (now folded in here, since every real page in
// this app wants the same chrome anyway).
export default function AdminLayout({ children, title, subtitle }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialCollapsedState);
  // AdminSidebar's own onCloseMobile (wired to its nav buttons) is the
  // only way to navigate in this app -- unlike apps/dashboard, there's no
  // in-page content link that could navigate without going through it, so
  // there's no separate "close on any route change" effect needed as a
  // safety net.
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-brand-700 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <AdminHeader
        title={title}
        subtitle={subtitle}
        isSidebarCollapsed={isSidebarCollapsed}
        onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
      />

      <div className={`flex-1 min-w-0 pt-20 bg-gray-50 transition-[margin] duration-300 ml-0 ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
