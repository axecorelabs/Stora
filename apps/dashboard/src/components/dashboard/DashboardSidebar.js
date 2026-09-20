"use client";
import { useState, useEffect, useMemo } from "react";
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
  Settings,
  Truck,
  Wrench,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Images,
  BadgeCheck,
  Layers,
  Zap,
  Star,
  PlusCircle,
  Pencil,
  Clock3
} from "lucide-react";

const SIDEBAR_SECTION_STATE_KEY_PREFIX = "stora-sidebar-sections";
const SIDEBAR_FAVORITES_KEY_PREFIX = "stora-sidebar-favorites";
const SIDEBAR_USAGE_KEY_PREFIX = "stora-sidebar-usage";
const SIDEBAR_QUICK_ACTIONS_KEY_PREFIX = "stora-sidebar-quick-actions";
const DEFAULT_SUBSCRIPTION_START_AT = "2026-09-30T00:00:00Z";

function getSubscriptionStartMs() {
  const configured =
    process.env.NEXT_PUBLIC_FULL_STORE_SUBSCRIPTION_ENFORCEMENT_START ||
    DEFAULT_SUBSCRIPTION_START_AT;
  const parsed = Date.parse(configured);
  if (Number.isNaN(parsed)) return Date.parse(DEFAULT_SUBSCRIPTION_START_AT);
  return parsed;
}

function formatCountdown(remainingMs) {
  if (remainingMs <= 0) {
    return {
      headline: "Subscriptions are live",
      detail: "Billing start date reached"
    };
  }

  const totalMinutes = Math.floor(remainingMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return {
    headline: `Starts in ${days}d ${hours}h ${minutes}m`,
    detail: "Subscription launch countdown"
  };
}

function getSectionStorageKey(isListingMode) {
  return `${SIDEBAR_SECTION_STATE_KEY_PREFIX}-${isListingMode ? "listing" : "full_store"}`;
}

function getFavoritesStorageKey(isListingMode) {
  return `${SIDEBAR_FAVORITES_KEY_PREFIX}-${isListingMode ? "listing" : "full_store"}`;
}

function getUsageStorageKey(isListingMode) {
  return `${SIDEBAR_USAGE_KEY_PREFIX}-${isListingMode ? "listing" : "full_store"}`;
}

function getQuickActionsStorageKey(isListingMode) {
  return `${SIDEBAR_QUICK_ACTIONS_KEY_PREFIX}-${isListingMode ? "listing" : "full_store"}`;
}

function safeReadJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isItemActive(pathname, itemPath) {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return itemPath === "/dashboard/overview";
  }
  return pathname.startsWith(itemPath);
}

function createDefaultSectionState(sections, pathname) {
  const defaults = {};
  sections.forEach((section) => {
    const sectionHasActiveItem = section.items.some((item) => isItemActive(pathname, item.path));
    defaults[section.key] = section.key === "core" || sectionHasActiveItem;
  });
  return defaults;
}

function getSectionScore(section, usageMap) {
  return section.items.reduce((sum, item) => sum + (usageMap[item.path] || 0), 0);
}

function sortSectionsByUsage(baseSections, usageMap) {
  const coreSection = baseSections.find((section) => section.key === "core") || null;
  const accountSection = baseSections.find((section) => section.key === "account") || null;

  const adaptiveSections = baseSections.filter(
    (section) => section.key !== "core" && section.key !== "account"
  );

  adaptiveSections.sort((a, b) => {
    const scoreDelta = getSectionScore(b, usageMap) - getSectionScore(a, usageMap);
    if (scoreDelta !== 0) return scoreDelta;
    return a.title.localeCompare(b.title);
  });

  const ordered = [];
  if (coreSection) ordered.push(coreSection);
  ordered.push(...adaptiveSections);
  if (accountSection) ordered.push(accountSection);
  return ordered;
}

function sortItemsByUsage(section, usageMap) {
  const dashboardItem = section.items.find((item) => item.path === "/dashboard/overview") || null;
  const sortableItems = section.items.filter((item) => item.path !== "/dashboard/overview");

  sortableItems.sort((a, b) => {
    const scoreDelta = (usageMap[b.path] || 0) - (usageMap[a.path] || 0);
    if (scoreDelta !== 0) return scoreDelta;
    return a.name.localeCompare(b.name);
  });

  return dashboardItem ? [dashboardItem, ...sortableItems] : sortableItems;
}

export default function DashboardSidebar({ isCollapsed = false, onToggleCollapse, isMobileOpen = false, onCloseMobile }) {
  const router = useRouter();
  const pathname = usePathname();
  const { secureApiCall } = useAuth();
  const [openSections, setOpenSections] = useState({});
  const [hasLoadedSectionState, setHasLoadedSectionState] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [usageMap, setUsageMap] = useState({});
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [isManagingPins, setIsManagingPins] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const subscriptionStartMs = useMemo(() => getSubscriptionStartMs(), []);
  const subscriptionCountdown = useMemo(
    () => formatCountdown(subscriptionStartMs - nowMs),
    [subscriptionStartMs, nowMs]
  );
  const subscriptionStartDateLabel = useMemo(
    () =>
      new Date(subscriptionStartMs).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }),
    [subscriptionStartMs]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  // Same ['store'] queryKey DashboardHeader.js/inventory/page.js already
  // use, so this shares their cache instead of firing its own request.
  // Catalogue/Services are now conditional on what this business actually
  // does (set at business-creation time, CreateBusinessModal.js) instead of
  // always showing both regardless -- a pure-services business shouldn't
  // see an empty product catalog nav item, and vice versa.
  const { data: storeResponse, isLoading: isStoreLoading } = useQuery({
    queryKey: ['store'],
    queryFn: () => secureApiCall('/api/stores'),
    staleTime: 5 * 60 * 1000
  });
  const store = storeResponse?.data;
  // Don't derive isListingMode until we have a real answer -- undefined
  // would be falsy and show the full store nav first, causing a flicker
  // on cold load. Keep menuItems null while loading and render skeleton
  // dots instead.
  const storeLoaded = !isStoreLoading && storeResponse !== undefined;
  const isListingMode = store?.platformMode === 'listing';
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

  const baseMenuSections = isListingMode
    ? [
        {
          key: "core",
          title: "Core",
          items: [
            { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard/overview" },
            { name: "Showcase", icon: Layers, path: "/dashboard/website" }
          ]
        },
        {
          key: "presence",
          title: "Presence",
          items: [
            { name: "Gallery", icon: Images, path: "/dashboard/gallery" },
            { name: "Services", icon: Wrench, path: "/dashboard/services" },
            { name: "Business Info", icon: Store, path: "/dashboard/store" }
          ]
        },
        {
          key: "account",
          title: "Account",
          items: [
            { name: "Subscription", icon: BadgeCheck, path: "/dashboard/subscription" },
            { name: "Settings", icon: Settings, path: "/dashboard/settings" }
          ]
        }
      ]
    : [
        {
          key: "core",
          title: "Core",
          items: [
            { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard/overview" },
            { name: "Orders", icon: ShoppingBag, path: "/dashboard/orders" },
            { name: "POS", icon: CreditCard, path: "/dashboard/pos" }
          ]
        },
        {
          key: "commerce",
          title: "Commerce",
          items: [
            ...(showCatalogue ? [{ name: "Catalogue", icon: Package, path: "/dashboard/inventory" }] : []),
            ...(showServices ? [{ name: "Services", icon: Wrench, path: "/dashboard/services" }] : []),
            { name: "Sales", icon: Receipt, path: "/dashboard/sales" },
            { name: "Payments", icon: Wallet, path: "/dashboard/payments" },
            { name: "Deliveries", icon: Truck, path: "/dashboard/deliveries" }
          ]
        },
        {
          key: "presence",
          title: "Presence",
          items: [
            { name: "Store", icon: Store, path: "/dashboard/store" },
            { name: "Website", icon: Globe, path: "/dashboard/website" },
            { name: "Gallery", icon: Images, path: "/dashboard/gallery" }
          ]
        },
        {
          key: "account",
          title: "Account",
          items: [
            { name: "Subscription", icon: BadgeCheck, path: "/dashboard/subscription" },
            { name: "Settings", icon: Settings, path: "/dashboard/settings" }
          ]
        }
      ];

  const menuSections = useMemo(() => {
    const withItemOrdering = baseMenuSections.map((section) => ({
      ...section,
      items: sortItemsByUsage(section, usageMap)
    }));
    return sortSectionsByUsage(withItemOrdering, usageMap);
  }, [baseMenuSections, usageMap]);

  const quickActions = useMemo(
    () =>
      isListingMode
        ? [
            { name: "Update showcase", path: "/dashboard/website", icon: Layers },
            { name: "Add gallery", path: "/dashboard/gallery", icon: Images },
            { name: "Add service", path: "/dashboard/services", icon: PlusCircle }
          ]
        : [
            // Same showCatalogue/showServices gate the Commerce section
            // above already applies -- these used to be unconditional, so
            // a services-only vendor saw "New product" (and a
            // products-only vendor saw "Add service") pointing at a page
            // the main nav had deliberately hidden from them.
            ...(showCatalogue ? [{ name: "New product", path: "/dashboard/inventory", icon: PlusCircle }] : []),
            { name: "Record sale", path: "/dashboard/pos", icon: Receipt },
            ...(showServices ? [{ name: "Add service", path: "/dashboard/services", icon: Wrench }] : [])
          ],
    [isListingMode, showCatalogue, showServices]
  );

  const flattenedMenuItems = useMemo(
    () =>
      menuSections.flatMap((section) =>
        section.items.map((item) => ({ ...item, sectionKey: section.key }))
      ),
    [menuSections]
  );

  const favoriteMenuItems = useMemo(() => {
    if (!favorites.length) return [];
    return favorites
      .map((path) => flattenedMenuItems.find((item) => item.path === path))
      .filter(Boolean);
  }, [favorites, flattenedMenuItems]);

  const collapsedModeItems = useMemo(() => {
    if (!favoriteMenuItems.length) return flattenedMenuItems;
    const favoritePathSet = new Set(favoriteMenuItems.map((item) => item.path));
    const nonFavorites = flattenedMenuItems.filter((item) => !favoritePathSet.has(item.path));
    return [...favoriteMenuItems, ...nonFavorites];
  }, [favoriteMenuItems, flattenedMenuItems]);

  useEffect(() => {
    if (!storeLoaded) return;

    const storageKey = getSectionStorageKey(isListingMode);
    const defaults = createDefaultSectionState(menuSections, pathname);

    let saved = {};
    try {
      const raw = localStorage.getItem(storageKey);
      saved = raw ? JSON.parse(raw) : {};
    } catch {
      saved = {};
    }

    const sectionWithActiveRoute = menuSections.find((section) =>
      section.items.some((item) => isItemActive(pathname, item.path))
    );

    const merged = Object.fromEntries(
      menuSections.map((section) => [
        section.key,
        typeof saved[section.key] === "boolean" ? saved[section.key] : defaults[section.key]
      ])
    );
    if (Object.prototype.hasOwnProperty.call(merged, "core")) {
      merged.core = true;
    }
    if (sectionWithActiveRoute) {
      merged[sectionWithActiveRoute.key] = true;
    }

    const favoriteStorageKey = getFavoritesStorageKey(isListingMode);
    const favoritesRaw = localStorage.getItem(favoriteStorageKey);
    const nextFavorites = safeReadJson(favoritesRaw, []);
    setFavorites(Array.isArray(nextFavorites) ? nextFavorites.slice(0, 3) : []);

    const usageStorageKey = getUsageStorageKey(isListingMode);
    const usageRaw = localStorage.getItem(usageStorageKey);
    const nextUsage = safeReadJson(usageRaw, {});
    setUsageMap(nextUsage && typeof nextUsage === "object" ? nextUsage : {});

    const quickStorageKey = getQuickActionsStorageKey(isListingMode);
    const quickRaw = localStorage.getItem(quickStorageKey);
    const quickState = safeReadJson(quickRaw, false);

    setHasLoadedSectionState(true);
    setOpenSections(merged);
    setQuickActionsOpen(quickState === true);
  }, [storeLoaded, isListingMode, showCatalogue, showServices]);

  useEffect(() => {
    if (!storeLoaded || !hasLoadedSectionState) return;

    const sectionWithActiveRoute = menuSections.find((section) =>
      section.items.some((item) => isItemActive(pathname, item.path))
    );

    if (!sectionWithActiveRoute) return;

    setOpenSections((prev) => {
      if (prev[sectionWithActiveRoute.key]) return prev;
      return {
        ...prev,
        [sectionWithActiveRoute.key]: true
      };
    });
  }, [storeLoaded, hasLoadedSectionState, menuSections, pathname]);

  useEffect(() => {
    if (!storeLoaded) return;
    const storageKey = getSectionStorageKey(isListingMode);
    localStorage.setItem(storageKey, JSON.stringify(openSections));
  }, [openSections, storeLoaded, isListingMode]);

  useEffect(() => {
    if (!storeLoaded) return;
    const storageKey = getFavoritesStorageKey(isListingMode);
    localStorage.setItem(storageKey, JSON.stringify(favorites));
  }, [favorites, storeLoaded, isListingMode]);

  useEffect(() => {
    if (!storeLoaded) return;
    const storageKey = getUsageStorageKey(isListingMode);
    localStorage.setItem(storageKey, JSON.stringify(usageMap));
  }, [usageMap, storeLoaded, isListingMode]);

  useEffect(() => {
    if (!storeLoaded) return;
    const storageKey = getQuickActionsStorageKey(isListingMode);
    localStorage.setItem(storageKey, JSON.stringify(quickActionsOpen));
  }, [quickActionsOpen, storeLoaded, isListingMode]);

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleNavigation = (item, sectionKey = null) => {
    setUsageMap((prev) => ({
      ...prev,
      [item.path]: (prev[item.path] || 0) + 1,
      ...(sectionKey ? { [`section:${sectionKey}`]: (prev[`section:${sectionKey}`] || 0) + 1 } : {})
    }));
    router.push(item.path);
    onCloseMobile?.();
  };

  const toggleFavorite = (itemPath) => {
    setFavorites((prev) => {
      const exists = prev.includes(itemPath);
      if (exists) return prev.filter((path) => path !== itemPath);
      return [itemPath, ...prev].slice(0, 3);
    });
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
        <div className="space-y-3">
          {!storeLoaded ? (
            // Skeleton placeholders while store mode is being determined --
            // prevents the full store nav flashing before switching to the
            // listing nav on cold load.
            [...Array(4)].map((_, i) => (
              <div key={i} className={`h-11 rounded-xl bg-gray-100 animate-pulse ${isCollapsed ? 'lg:w-11' : ''}`} />
            ))
          ) : isCollapsed ? (
            collapsedModeItems.map((item) => {
              const IconComponent = item.icon;
              const itemIsActive = isItemActive(pathname, item.path);
              const showBadge = item.name === 'Orders' && pendingOrdersCount > 0;

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item, item.sectionKey)}
                  title={item.name}
                  className={`relative w-full flex items-center font-display text-sm font-medium rounded-xl transition-all duration-200 ${
                    'justify-between px-4 py-3 lg:justify-center lg:px-2 lg:py-3'
                  } ${
                    itemIsActive
                      ? 'bg-brand-800 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-brand-50'
                  }`}
                >
                  <div className="flex items-center">
                    <IconComponent className={`h-5 w-5 mr-3 lg:mr-0 ${itemIsActive ? 'text-white' : 'text-gray-500'}`} />
                    <span className="lg:hidden">{item.name}</span>
                  </div>
                  {showBadge && (
                    <>
                      <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white hidden lg:block" />
                      <span className="flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full lg:hidden">
                        {pendingOrdersCount}
                      </span>
                    </>
                  )}
                </button>
              );
            })
          ) : (
            <>
              {menuSections.map((section) => {
                const isOpen = hasLoadedSectionState ? openSections[section.key] !== false : false;
                const activeWithinSection = section.items.some((item) => isItemActive(pathname, item.path));
                const hasOrders = section.items.some((item) => item.name === "Orders");

                return (
                  <div key={section.key} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className={`w-full px-2 py-1.5 flex items-center justify-between rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                        activeWithinSection
                          ? "text-brand-800 bg-brand-50"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{section.title}</span>
                        {hasOrders && pendingOrdersCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                            {pendingOrdersCount}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="space-y-2">
                        {section.items.map((item) => {
                          const IconComponent = item.icon;
                          const itemIsActive = isItemActive(pathname, item.path);
                          const showBadge = item.name === "Orders" && pendingOrdersCount > 0;
                          const isFavorited = favorites.includes(item.path);

                          return (
                            <button
                              key={item.path}
                              onClick={() => handleNavigation(item, section.key)}
                              className={`relative w-full flex items-center font-display text-sm font-medium rounded-xl transition-all duration-200 justify-between px-4 py-3 ${
                                itemIsActive
                                  ? "bg-brand-800 text-white shadow-lg"
                                  : "text-gray-600 hover:text-gray-900 hover:bg-brand-50"
                              }`}
                            >
                              <div className="flex items-center min-w-0">
                                <IconComponent className={`h-5 w-5 mr-3 ${itemIsActive ? 'text-white' : 'text-gray-500'}`} />
                                <span className="truncate">{item.name}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                {showBadge && (
                                  <span className="flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full">
                                    {pendingOrdersCount}
                                  </span>
                                )}
                                {isManagingPins && (
                                  <span
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleFavorite(item.path);
                                    }}
                                    className={`w-6 h-6 inline-flex items-center justify-center rounded-md ${
                                      isFavorited
                                        ? "text-amber-700 bg-amber-100"
                                        : "text-gray-400 hover:text-amber-700 hover:bg-amber-50"
                                    }`}
                                    role="button"
                                    aria-label={isFavorited ? "Unpin item" : "Pin item"}
                                    title={isFavorited ? "Unpin" : "Pin"}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isFavorited ? "fill-current" : ""}`} />
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {isManagingPins && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  Pin mode is on. Tap stars beside items to add up to 3 pinned shortcuts.
                </div>
              )}

              {favoriteMenuItems.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Star className="w-3.5 h-3.5" />
                      <span>Pinned</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsManagingPins((prev) => !prev)}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white/70 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-white"
                    >
                      <Pencil className="w-3 h-3" />
                      {isManagingPins ? "Done" : "Manage"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {favoriteMenuItems.map((item) => {
                      const IconComponent = item.icon;
                      const itemIsActive = isItemActive(pathname, item.path);
                      const showBadge = item.name === "Orders" && pendingOrdersCount > 0;

                      return (
                        <button
                          key={`favorite-${item.path}`}
                          onClick={() => handleNavigation(item, item.sectionKey)}
                          className={`relative w-full flex items-center font-display text-sm font-medium rounded-xl transition-all duration-200 justify-between px-4 py-3 ${
                            itemIsActive
                              ? "bg-brand-800 text-white shadow-lg"
                              : "text-gray-700 hover:text-gray-900 hover:bg-brand-50"
                          }`}
                        >
                          <div className="flex items-center min-w-0">
                            <IconComponent className={`h-5 w-5 mr-3 ${itemIsActive ? 'text-white' : 'text-gray-500'}`} />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {showBadge && (
                              <span className="flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full">
                                {pendingOrdersCount}
                              </span>
                            )}
                            {isManagingPins && (
                              <span
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavorite(item.path);
                                }}
                                className="w-6 h-6 inline-flex items-center justify-center rounded-md bg-amber-100 text-amber-700"
                                role="button"
                                aria-label="Unpin item"
                                title="Unpin"
                              >
                                <Star className="w-3.5 h-3.5 fill-current" />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {favoriteMenuItems.length === 0 && (
                <div className="px-2 py-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 rounded-lg">
                  <span>Pinned</span>
                  <button
                    type="button"
                    onClick={() => setIsManagingPins((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    <Pencil className="w-3 h-3" />
                    {isManagingPins ? "Done" : "Manage"}
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setQuickActionsOpen((prev) => !prev)}
                  className="w-full px-2 py-1.5 flex items-center justify-between rounded-lg text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Quick Actions</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${quickActionsOpen ? 'rotate-180' : ''}`} />
                </button>

                {quickActionsOpen && (
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((action) => {
                      const ActionIcon = action.icon;
                      return (
                        <button
                          key={action.path}
                          onClick={() => handleNavigation(action, "core")}
                          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-brand-50 hover:border-brand-200"
                        >
                          <ActionIcon className="w-3.5 h-3.5 text-gray-500" />
                          <span className="truncate">{action.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </nav>

      <div className={`border-t border-gray-200 ${isCollapsed ? 'px-2 py-3 lg:px-2' : 'px-4 py-3'}`}>
        {isCollapsed ? (
          <div
            className="flex items-center justify-center w-full h-10 rounded-lg bg-gray-50 text-gray-600"
            title={`${subscriptionCountdown.headline} • ${subscriptionStartDateLabel}`}
          >
            <Clock3 className="w-4 h-4" />
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <Clock3 className="w-3.5 h-3.5" />
              <span>Subscription Start</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-900">{subscriptionCountdown.headline}</p>
            <p className="text-[11px] text-gray-500">{subscriptionStartDateLabel}</p>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
