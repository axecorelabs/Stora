"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Package,
  CreditCard,
  Store,
  Globe,
  ShoppingBag,
  Receipt,
  BarChart3,
  Settings,
  Truck,
  Wrench,  // Add Wrench icon for services
  Wallet,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";

export default function DashboardSidebar({ isCollapsed = false, onToggleCollapse, isMobileOpen = false, onCloseMobile }) {
  const router = useRouter();
  const pathname = usePathname();
  const { secureApiCall } = useAuth();
  const [activeTab, setActiveTab] = useState('');

  // Same ['store'] queryKey DashboardHeader.js/inventory/page.js already
  // use, so this shares their cache instead of firing its own request.
  // Catalogue/Services are now conditional on what this business actually
  // does (set at business-creation time, CreateBusinessModal.js) instead of
  // always showing both regardless -- a pure-services business shouldn't
  // see an empty product catalog nav item, and vice versa.
  const { data: storeResponse } = useQuery({
    queryKey: ['store'],
    queryFn: () => secureApiCall('/api/stores'),
    staleTime: 5 * 60 * 1000
  });
  const store = storeResponse?.data;
  // Defaults to showing Catalogue while the store hasn't loaded yet
  // (undefined !== false) -- avoids a flash of "no nav items" on first
  // paint, same fail-open reasoning as sellsProducts' own DB default.
  const showCatalogue = store ? (!!store.sellsProducts || !!store.restaurantMode) : true;
  const showServices = !!store?.offersServices;

  // Pending-orders badge -- shares the ['orders-stats'] query key already
  // used by useReportsData.js, so both consumers share one cache entry, and
  // the realtime hook's invalidateQueries(['orders-stats']) reaches this
  // badge instead of only a local setInterval poll nothing else can trigger.
  const { data: orderStats } = useQuery({
    queryKey: ['orders-stats'],
    queryFn: async () => {
      const response = await fetch('/api/orders/stats');
      if (!response.ok) return null;
      const data = await response.json();
      return data.success ? data.stats : null;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const pendingOrdersCount = orderStats?.pendingOrders || 0;

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/overview' },
    ...(showCatalogue ? [{ name: 'Catalogue', icon: Package, path: '/dashboard/inventory' }] : []),
    ...(showServices ? [{ name: 'Services', icon: Wrench, path: '/dashboard/services' }] : []),
    { name: 'Store', icon: Store, path: '/dashboard/store' },
    { name: 'POS', icon: CreditCard, path: '/dashboard/pos' },
    { name: 'Website', icon: Globe, path: '/dashboard/website' },
    { name: 'Orders', icon: ShoppingBag, path: '/dashboard/orders' },
    { name: 'Sales', icon: Receipt, path: '/dashboard/sales' },
    { name: 'Payments', icon: Wallet, path: '/dashboard/payments' },
    { name: 'Deliveries', icon: Truck, path: '/dashboard/deliveries' },
    // { name: 'Reports & Analysis', icon: BarChart3, path: '/dashboard/reports' }, // Temporarily removed
    { name: 'Settings', icon: Settings, path: '/dashboard/settings' },
  ];

  // Update active tab based on current pathname
  useEffect(() => {
    const currentItem = menuItems.find(item => {
      if (pathname === '/dashboard' || pathname === '/dashboard/') {
        return item.name === 'Dashboard';
      }
      return pathname.startsWith(item.path);
    });
    
    if (currentItem) {
      setActiveTab(currentItem.name);
    }
  }, [pathname]);

  const handleNavigation = (item) => {
    // Immediately update the active state to prevent flicker
    setActiveTab(item.name);
    router.push(item.path);
    onCloseMobile?.();
  };

  return (
    <>
      {/* Scrim -- mobile-only, sits between the header/content and the
          drawer so a tap outside the drawer closes it. Irrelevant at lg:
          and above, where the sidebar is always visible/fixed. */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <div
        className={`fixed left-0 top-0 bg-white h-screen flex flex-col border-r border-gray-200 z-40 w-64 transition-transform duration-300 lg:transition-[width] ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
      {/* Collapse toggle -- desktop only; mobile gets a close (X) button
          in the logo row instead, since "collapse to icons-only" doesn't
          make sense for an off-canvas drawer. */}
      <button
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden lg:flex absolute -right-3 top-8 items-center justify-center w-6 h-6 bg-white text-gray-500 border border-gray-200 rounded-full shadow-md hover:text-brand-800 hover:border-brand-800 transition-colors z-40"
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Logo -- the drawer is always in its "expanded" layout below lg
          regardless of the desktop icon-only collapse preference (which
          persists via localStorage and would otherwise open the mobile
          drawer already collapsed to icons). Collapse only takes visual
          effect at lg: and above. */}
      <div className={`p-6 flex items-center justify-between ${isCollapsed ? 'lg:px-0 lg:justify-center' : ''}`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
            <img src="/stora.png" alt="Stora Logo" className="object-contain w-full h-full" />
          </div>
          <div className={`flex flex-col ${isCollapsed ? 'lg:hidden' : ''}`}>
            <span className="font-display text-lg font-bold text-gray-900">Stora</span>
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

      {/* Navigation -- same "expanded below lg regardless of collapse
          preference" rule as the logo above. */}
      <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-4 lg:px-3' : 'px-4'}`}>
        <div className="space-y-2">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.name;
            const showBadge = item.name === 'Orders' && pendingOrdersCount > 0;

            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item)}
                title={isCollapsed ? item.name : undefined}
                className={`relative w-full flex items-center font-display text-sm font-medium rounded-xl transition-all duration-200 ${
                  isCollapsed ? 'justify-between px-4 py-3 lg:justify-center lg:px-2 lg:py-3' : 'justify-between px-4 py-3'
                } ${
                  isActive
                    ? 'bg-brand-800 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-brand-50'
                }`}
              >
                <div className="flex items-center">
                  <IconComponent className={`h-5 w-5 mr-3 ${isCollapsed ? 'lg:mr-0' : ''} ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  <span className={isCollapsed ? 'lg:hidden' : ''}>{item.name}</span>
                </div>
                {showBadge && (
                  <>
                    <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white ${isCollapsed ? 'hidden lg:block' : 'hidden'}`} />
                    <span className={`flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full ${isCollapsed ? 'lg:hidden' : ''}`}>
                      {pendingOrdersCount}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>
      </div>
    </>
  );
}
