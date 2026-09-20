"use client";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Images, Layers, LayoutDashboard, MoreHorizontal, Package, ShoppingBag, Wallet, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// The 4 destinations a vendor actually reaches for on a phone, plus a
// catch-all -- everything else (Store, POS, Website, Sales, Deliveries,
// Settings) still lives one tap away behind "More", which opens the same
// drawer the old header hamburger did. Replaces that hamburger entirely
// below lg (see DashboardHeader.js) rather than running two different
// nav entry points side by side -- a native app picks one pattern, not
// both.
//
// The 3rd tab is picked dynamically (see getCommerceThirdTab below) --
// this used to be a hardcoded "Catalogue" tab regardless of business
// type, unlike DashboardSidebar.js's own Commerce section, which
// correctly hides Catalogue for a vendor who doesn't sell products
// (showCatalogue = sellsProducts || restaurantMode). A services-only
// vendor got a permanent bottom-nav tab pointing at an inventory page
// the desktop nav had deliberately hidden from them.
function getCommerceThirdTab(store) {
  const showCatalogue = store ? (!!store.sellsProducts || !!store.restaurantMode) : true;
  if (showCatalogue) return { name: "Catalogue", icon: Package, path: "/dashboard/inventory" };
  if (store?.offersServices) return { name: "Services", icon: Wrench, path: "/dashboard/services" };
  return { name: "Catalogue", icon: Package, path: "/dashboard/inventory" };
}

function getCommerceTabs(store) {
  return [
    { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard/overview" },
    { name: "Orders", icon: ShoppingBag, path: "/dashboard/orders" },
    getCommerceThirdTab(store),
    { name: "Payments", icon: Wallet, path: "/dashboard/payments" },
  ];
}

const LISTING_TABS = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard/overview" },
  { name: "Gallery", icon: Images, path: "/dashboard/gallery" },
  { name: "Services", icon: Wrench, path: "/dashboard/services" },
  { name: "Showcase", icon: Layers, path: "/dashboard/website" },
];

export default function MobileBottomNav({ onOpenMore }) {
  const router = useRouter();
  const pathname = usePathname();
  const { secureApiCall } = useAuth();

  const { data: storeResponse } = useQuery({
    queryKey: ["store"],
    queryFn: () => secureApiCall('/api/stores').catch(() => null),
    staleTime: 5 * 60 * 1000,
  });
  const store = storeResponse?.data;
  const isListingMode = store?.platformMode === "listing";
  const tabs = isListingMode ? LISTING_TABS : getCommerceTabs(store);

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
        {tabs.map((tab) => {
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
              <span className={`font-display text-[11px] font-medium truncate ${active ? "text-brand-800" : "text-gray-500"}`}>
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
          <span className="font-display text-[11px] font-medium text-gray-500">More</span>
        </button>
      </div>
    </nav>
  );
}
