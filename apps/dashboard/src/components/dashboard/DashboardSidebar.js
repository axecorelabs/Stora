"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export default function DashboardSidebar({ isCollapsed = false, onToggleCollapse }) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('');

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
    { name: 'Catalogue', icon: Package, path: '/dashboard/inventory' },
    // { name: 'Services', icon: Wrench, path: '/dashboard/services' }, // Add services menu item
    { name: 'Store', icon: Store, path: '/dashboard/store' },
    { name: 'POS', icon: CreditCard, path: '/dashboard/pos' },
    { name: 'Website', icon: Globe, path: '/dashboard/website' },
    { name: 'Orders', icon: ShoppingBag, path: '/dashboard/orders' },
    { name: 'Sales', icon: Receipt, path: '/dashboard/sales' },
    { name: 'Payments', icon: Wallet, path: '/dashboard/payments' },
    { name: 'Deliveries', icon: Truck, path: '/dashboard/deliveries' },
    { name: 'Verification', icon: ShieldCheck, path: '/dashboard/verification' },
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
  };

  return (
    <div
      className={`fixed left-0 top-0 bg-white h-screen flex flex-col border-r border-gray-200 z-30 transition-[width] duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-8 flex items-center justify-center w-6 h-6 bg-white text-gray-500 border border-gray-200 rounded-full shadow-md hover:text-brand-800 hover:border-brand-800 transition-colors z-40"
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Logo */}
      <div className={`p-6 ${isCollapsed ? 'px-0 flex justify-center' : ''}`}>
        <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
            <img src="/stora.png" alt="Stora Logo" className="object-contain w-full h-full" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">Stora</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-3' : 'px-4'}`}>
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
                className={`relative w-full flex items-center text-sm font-medium rounded-xl transition-all duration-200 ${
                  isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3'
                } ${
                  isActive
                    ? 'bg-brand-800 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-brand-50'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? '' : ''}`}>
                  <IconComponent className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  {!isCollapsed && item.name}
                </div>
                {showBadge && (
                  isCollapsed ? (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                  ) : (
                    <span className="flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full">
                      {pendingOrdersCount}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
