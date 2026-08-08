"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  Wrench  // Add Wrench icon for services
} from "lucide-react";

export default function DashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('');
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/overview' },
    { name: 'Catalogue', icon: Package, path: '/dashboard/inventory' },
    // { name: 'Services', icon: Wrench, path: '/dashboard/services' }, // Add services menu item
    { name: 'Store', icon: Store, path: '/dashboard/store' },
    { name: 'Sales Terminal (POS)', icon: CreditCard, path: '/dashboard/pos' },
    { name: 'Website', icon: Globe, path: '/dashboard/website' },
    { name: 'Orders', icon: ShoppingBag, path: '/dashboard/orders' },
    { name: 'Sales', icon: Receipt, path: '/dashboard/sales' },
    { name: 'Deliveries', icon: Truck, path: '/dashboard/deliveries' },
    { name: 'Reports & Analysis', icon: BarChart3, path: '/dashboard/reports' },
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

  // Fetch pending orders count
  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        const response = await fetch('/api/orders/stats');
        if (response.ok) {
          const data = await response.json();
          setPendingOrdersCount(data.stats?.pendingOrders || 0);
        }
      } catch (error) {
        console.error('Error fetching pending orders:', error);
      }
    };

    fetchPendingOrders();
    
    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingOrders, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleNavigation = (item) => {
    // Immediately update the active state to prevent flicker
    setActiveTab(item.name);
    router.push(item.path);
  };

  return (
    <div className="fixed left-0 top-0 w-64 bg-white h-screen flex flex-col border-r border-gray-200 z-30">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
            <div className="w-6 h-6 bg-white rounded-full"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900">IVMA</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 overflow-y-auto">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.name;
            const showBadge = item.name === 'Orders' && pendingOrdersCount > 0;
            
            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <IconComponent className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  {item.name}
                </div>
                {showBadge && (
                  <span className="flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full">
                    {pendingOrdersCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
