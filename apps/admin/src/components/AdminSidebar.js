"use client";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Store, Package, Wallet, BarChart3, Handshake, Sparkles, ChevronLeft, ChevronRight, X } from "lucide-react";

// Same structural shape as apps/dashboard's own DashboardSidebar.js
// (fixed on desktop, off-canvas drawer below lg, collapsible to
// icons-only).
const MENU_ITEMS = [
  { name: "Overview", icon: LayoutDashboard, path: "/overview" },
  { name: "Vendors", icon: Store, path: "/stores" },
  { name: "Products", icon: Package, path: "/products" },
  { name: "Payments", icon: Wallet, path: "/payments" },
  { name: "Analytics", icon: BarChart3, path: "/analytics" },
  { name: "Partners", icon: Handshake, path: "/partners" },
  { name: "Campaigns", icon: Sparkles, path: "/campaigns" },
];

export default function AdminSidebar({ isCollapsed = false, onToggleCollapse, isMobileOpen = false, onCloseMobile }) {
  const router = useRouter();
  const pathname = usePathname();
  // Derived directly from the current route, not a separate state+effect
  // pair -- pathname is already reactive, so there's nothing to
  // synchronize here.
  const activeTab = MENU_ITEMS.find((item) => pathname.startsWith(item.path))?.name;

  const handleNavigation = (item) => {
    router.push(item.path);
    onCloseMobile?.();
  };

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onCloseMobile} />
      )}
      <div
        className={`fixed left-0 top-0 bg-white h-screen flex flex-col border-r border-gray-200 z-40 w-64 transition-transform duration-300 lg:transition-[width] ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${isCollapsed ? "lg:w-20" : "lg:w-64"}`}
      >
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:flex absolute -right-3 top-8 items-center justify-center w-6 h-6 bg-white text-gray-500 border border-gray-200 rounded-full shadow-md hover:text-brand-800 hover:border-brand-800 transition-colors z-40"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        <div className={`p-6 flex items-center justify-between ${isCollapsed ? "lg:px-0 lg:justify-center" : ""}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
              <img src="/stora.png" alt="Stora Logo" className="object-contain w-full h-full" />
            </div>
            <div className={`flex flex-col ${isCollapsed ? "lg:hidden" : ""}`}>
              <span className="text-lg font-bold text-gray-900 leading-tight">Stora</span>
              <span className="text-xs font-medium text-gold-600 leading-tight">Admin</span>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto ${isCollapsed ? "px-4 lg:px-3" : "px-4"}`}>
          <div className="space-y-2">
            {MENU_ITEMS.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item)}
                  title={isCollapsed ? item.name : undefined}
                  className={`relative w-full flex items-center text-sm font-medium rounded-xl transition-all duration-200 ${
                    isCollapsed ? "justify-between px-4 py-3 lg:justify-center lg:px-2 lg:py-3" : "justify-between px-4 py-3"
                  } ${
                    isActive
                      ? "bg-brand-800 text-white shadow-lg"
                      : "text-gray-600 hover:text-gray-900 hover:bg-brand-50"
                  }`}
                >
                  <div className="flex items-center">
                    <IconComponent className={`h-5 w-5 mr-3 ${isCollapsed ? "lg:mr-0" : ""} ${isActive ? "text-white" : "text-gray-500"}`} />
                    <span className={isCollapsed ? "lg:hidden" : ""}>{item.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
