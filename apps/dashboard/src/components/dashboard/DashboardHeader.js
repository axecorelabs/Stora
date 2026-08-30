"use client";
import { Bell, ChevronDown, LogOut, Settings, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import NotificationPanel from "./NotificationPanel";
import NavigationProgressBar from "./NavigationProgressBar";

export default function DashboardHeader({ title = "Inventory Management", subtitle = "Today, August 16th 2024", isSidebarCollapsed = false }) {
  const { user, signOut, secureApiCall } = useAuth();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Same ['store'] queryKey usePOSData.js/inventory/page.js already use, so
  // this shares their cache instead of firing its own request -- this
  // header renders on every dashboard page (via DashboardLayout.js), which
  // is the point: a vendor should be able to tell Restaurant Mode is on
  // without navigating to Store > Preferences or the storefront itself.
  const { data: storeResponse } = useQuery({
    queryKey: ['store'],
    queryFn: () => secureApiCall('/api/stores'),
    staleTime: 5 * 60 * 1000
  });
  const restaurantMode = !!storeResponse?.data?.restaurantMode;

  // Unread notification count -- on TanStack Query (not a local
  // setInterval poll) so the realtime hook's invalidateQueries(['notifications'])
  // actually reaches this badge. refetchInterval is now just a fallback for
  // missed/dropped realtime events, not the primary update mechanism.
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const response = await secureApiCall('/api/notifications?unreadOnly=true&limit=1');
      return response.success ? (response.data.unreadCount || 0) : 0;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await signOut();
  };

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 bg-white px-4 lg:px-6 py-5 border-b border-gray-200 z-20 transition-[left] duration-300 ${isSidebarCollapsed ? 'lg:left-20' : 'lg:left-64'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl lg:text-2xl font-bold text-gray-900 truncate">{title}</h1>
                {restaurantMode && (
                  <span
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-800 shrink-0"
                    title="This store is in Restaurant Mode -- menu-first item form, sectioned storefront menu"
                  >
                    <UtensilsCrossed className="w-3 h-3" />
                    <span className="hidden sm:inline">Restaurant Mode</span>
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-sm text-gray-500 mt-1 truncate">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
            {/* Notifications */}
            <button 
              onClick={() => setIsNotificationPanelOpen(true)}
              className="relative p-2.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition-all duration-200"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </button>
            
            {/* User Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-3 bg-gray-50 rounded-xl px-3 py-2 hover:bg-gray-100 transition-all duration-200"
              >
                <div className="w-8 h-8 bg-brand-800 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="hidden sm:inline text-sm font-medium text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-brand-800 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        router.push('/dashboard/settings');
                      }}
                      className="w-full flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 mr-3" />
                      Account Settings
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 pt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* useSearchParams() inside needs its own boundary -- same pattern
            settings/page.js and others already use, scoped tight here so
            only this piece opts out of static rendering, not the whole
            header. */}
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
      </header>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={isNotificationPanelOpen}
        onClose={() => setIsNotificationPanelOpen(false)}
      />
    </>
  );
}
