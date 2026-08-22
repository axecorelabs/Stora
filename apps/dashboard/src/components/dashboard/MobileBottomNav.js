"use client";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, ShoppingBag, Package, Wallet, MoreHorizontal } from "lucide-react";

// The 4 destinations a vendor actually reaches for on a phone, plus a
// catch-all -- everything else (Store, POS, Website, Sales, Deliveries,
// Settings) still lives one tap away behind "More", which opens the same
// drawer the old header hamburger did. Replaces that hamburger entirely
// below lg (see DashboardHeader.js) rather than running two different
// nav entry points side by side -- a native app picks one pattern, not
// both.
const TABS = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard/overview" },
  { name: "Orders", icon: ShoppingBag, path: "/dashboard/orders" },
  { name: "Catalogue", icon: Package, path: "/dashboard/inventory" },
  { name: "Payments", icon: Wallet, path: "/dashboard/payments" },
];

export default function MobileBottomNav({ onOpenMore }) {
  const router = useRouter();
  const pathname = usePathname();

  // Same queryKey as DashboardSidebar.js's own badge -- TanStack Query
  // dedupes/caches by key, so this doesn't add a second network call, and
  // both badges stay in sync off the one realtime-invalidated entry.
  const { data: orderStats } = useQuery({
    queryKey: ["orders-stats"],
    queryFn: async () => {
      const response = await fetch("/api/orders/stats");
      if (!response.ok) return null;
      const data = await response.json();
      return data.success ? data.stats : null;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const pendingOrdersCount = orderStats?.pendingOrders || 0;

  const isActive = (path) =>
    (pathname === "/dashboard" || pathname === "/dashboard/") ? path === "/dashboard/overview" : pathname.startsWith(path);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="flex items-stretch">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          const showBadge = tab.name === "Orders" && pendingOrdersCount > 0;

          return (
            <button
              key={tab.name}
              onClick={() => router.push(tab.path)}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-w-0"
            >
              <span className="relative">
                <Icon className={`w-5 h-5 ${active ? "text-brand-800" : "text-gray-400"}`} strokeWidth={active ? 2.5 : 2} />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                    {pendingOrdersCount > 9 ? "9+" : pendingOrdersCount}
                  </span>
                )}
              </span>
              <span className={`text-[11px] font-medium truncate ${active ? "text-brand-800" : "text-gray-500"}`}>
                {tab.name}
              </span>
            </button>
          );
        })}

        <button
          onClick={onOpenMore}
          className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-w-0"
        >
          <MoreHorizontal className="w-5 h-5 text-gray-400" />
          <span className="text-[11px] font-medium text-gray-500">More</span>
        </button>
      </div>
    </nav>
  );
}
