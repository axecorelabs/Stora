"use client";
import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import EditInventoryModal from "@/components/dashboard/EditInventoryModal";
import StockUpdateModal from "@/components/dashboard/StockUpdateModal";
import DeleteConfirmationModal from "@/components/dashboard/DeleteConfirmationModal";
import CustomDropdown from "@/components/ui/CustomDropdown";
import ProductQrDownloadButton from "@/components/dashboard/Inventory/ProductQrDownloadButton";
import Modal from "@/components/ui/Modal";
import { useInventoryData } from "@/hooks/useInventoryData";
import useResponsiveRowExpand from "@/hooks/useResponsiveRowExpand";
import { bentoLastSpanClass } from "@/lib/statsBento";
import {
  Package,
  AlertTriangle,
  XCircle,
  ShoppingBag,
  Search,
  Filter,
  Plus,
  Edit,
  Eye,
  EyeOff,
  ExternalLink,
  X,
  TrendingUp,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
  Info
} from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const getCostPrice = (item) => item.currentCostPrice ?? item.costPrice ?? 0;
const getSellPrice = (item) => item.currentSellingPrice ?? item.sellingPrice ?? 0;
const getStockValue = (item) => item.quantityInStock * getCostPrice(item);
const getMarginPercent = (item) => {
  const sell = getSellPrice(item);
  const cost = getCostPrice(item);
  if (!sell) return null;
  return ((sell - cost) / sell) * 100;
};

const SORT_ACCESSORS = {
  productName: (item) => item.productName?.toLowerCase() || '',
  category: (item) => item.category?.toLowerCase() || '',
  stock: (item) => item.quantityInStock || 0,
  price: (item) => getSellPrice(item)
};

function SortIcon({ sortKey, sortDirection, columnKey }) {
  if (sortKey !== columnKey) return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
  return sortDirection === 'asc'
    ? <ChevronUp className="w-3 h-3 text-brand-800" />
    : <ChevronDown className="w-3 h-3 text-brand-800" />;
}

// Turns a camelCase categoryDetails key into a readable label, e.g. formFactor -> Form Factor
function prettifyKey(key) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
}

function DetailField({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-xs md:text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

// The full detail block a row reveals -- shared between the desktop
// inline-expand row and the mobile detail Modal (useResponsiveRowExpand)
// so the two never drift apart into two different feature sets.
function ItemDetailContent({
  item, margin, hasImage, categoryDetailEntries, formatCurrency, getStatusText,
  itemStorefrontUrl, store, onEdit, onAdjustStock, onViewFullPage, onToggleVisibility, isTogglingVisibility, onDelete
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-5 md:gap-8">
      {/* Bigger image */}
      <div className="w-full sm:w-40 md:w-44 h-40 md:h-44 flex-shrink-0 bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl flex items-center justify-center overflow-hidden mx-auto sm:mx-0">
        {hasImage ? (
          <img
            src={item.image || item.images[0].url}
            alt={item.productName}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <Package className={`w-12 h-12 text-brand-800 ${hasImage ? 'hidden' : ''}`} />
      </div>

      {/* Detail grid */}
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 md:gap-y-4">
          <DetailField label="SKU" value={item.sku} />
          <DetailField label="Brand" value={item.brand} />
          <DetailField label="Category" value={item.category} />
          <DetailField label="Supplier" value={item.supplier} />
          <DetailField label="Location" value={item.location} />
          <DetailField label="Stock" value={`${item.quantityInStock} ${item.unitOfMeasure || ''}`.trim()} />
          <DetailField label="Reorder Level" value={item.reorderLevel} />
          <DetailField label="Cost Price" value={formatCurrency(getCostPrice(item))} />
          <DetailField label="Selling Price" value={formatCurrency(getSellPrice(item))} />
          <DetailField label="Margin" value={margin !== null ? `${margin >= 0 ? '+' : ''}${margin.toFixed(0)}%` : null} />
          <DetailField label="Stock Value" value={formatCurrency(getStockValue(item))} />
          <DetailField label="Status" value={getStatusText(item)} />
          {item.batchPricing?.hasActiveBatch && (
            <DetailField label="Active Batch" value={item.batchPricing.activeBatchCode} />
          )}
          {categoryDetailEntries.map(([key, value]) => (
            <DetailField key={key} label={prettifyKey(key)} value={String(value)} />
          ))}
        </div>

        {item.description && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-xs md:text-sm text-gray-700">{item.description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit product
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustStock(item); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Adjust stock
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onViewFullPage(item); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View full page
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(item); }}
            disabled={isTogglingVisibility}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium border transition-colors disabled:opacity-50 ${
              item.webVisibility !== false
                ? 'text-gray-700 bg-white border-gray-200 hover:bg-gray-50'
                : 'text-gold-700 bg-gold-500/10 border-gold-500/30 hover:bg-gold-500/15'
            }`}
          >
            {isTogglingVisibility ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : item.webVisibility !== false ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            {item.webVisibility !== false ? 'Visible on website' : 'Hidden from website'}
          </button>
          {itemStorefrontUrl && (
            <>
              <a
                href={itemStorefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View in storefront
              </a>
              <ProductQrDownloadButton
                url={itemStorefrontUrl}
                color={store?.branding?.primaryColor || '#0B3B2E'}
                filename={`${item.sku || item._id}-qr-code.png`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              />
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 transition-colors ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCompactValue(value) {
  const numericValue = Number(value) || 0;
  const absValue = Math.abs(numericValue);

  if (absValue < 1000) return numericValue.toLocaleString('en-NG');
  if (absValue >= 1_000_000_000) return `${(numericValue / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (absValue >= 1_000_000) return `${(numericValue / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  return `${(numericValue / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
}

function CompactMetricValue({ value, formatValue, threshold = 1000 }) {
  const [isOpen, setIsOpen] = useState(false);
  const numericValue = Number(value ?? 0) || 0;

  if (Math.abs(numericValue) < threshold) {
    return <span>{formatValue(numericValue)}</span>;
  }

  return (
    <span className="relative inline-flex items-center gap-1">
      <span>{formatCompactValue(numericValue)}</span>
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
        title={formatValue(numericValue)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-[9px] font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100"
        aria-label={`View full value: ${formatValue(numericValue)}`}
      >
        ...
      </button>
      {isOpen && (
        <span className="absolute left-0 top-full z-20 mt-1 min-w-[150px] rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 shadow-lg">
          {formatValue(numericValue)}
        </span>
      )}
    </span>
  );
}

// The split-button info trigger's tooltip used to rely purely on CSS
// group-hover/group-focus-within -- neither fires reliably from a tap on
// touch devices (no :hover, and iOS Safari doesn't focus a tapped button),
// so the button looked tappable but silently did nothing on mobile. This
// gives it a real onClick that toggles the tooltip (with an outside-tap
// dismiss), while still opening on hover for desktop mouse users.
// The tooltip lives in an outer wrapper that is NOT overflow-hidden --
// only the pill (the two flat buttons) clips for its rounded/divided look.
// Nesting the tooltip inside that clipped pill (as the previous version
// did) meant it was clipped away entirely, on top of only ever opening via
// CSS group-hover/group-focus-within, neither of which fires reliably from
// a tap on touch devices (no :hover, and iOS Safari doesn't focus a tapped
// button). This gives the info trigger a real onClick that toggles the
// tooltip (with an outside-tap dismiss), while still opening on hover for
// desktop mouse users.
function SplitActionButton({ onAction, actionClassName, actionContent, pillClassName, infoLabel, infoTriggerClassName, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className="relative group/info inline-flex items-stretch">
      <div className={`inline-flex items-stretch overflow-hidden ${pillClassName}`}>
        <button onClick={onAction} className={actionClassName}>
          {actionContent}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsOpen((prev) => !prev); }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className={infoTriggerClassName}
          aria-label={infoLabel}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className={`pointer-events-none absolute right-0 top-[calc(100%+6px)] z-20 w-64 rounded-lg bg-gray-900 px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg ${
        isOpen ? 'block' : 'hidden group-hover/info:block'
      }`}>
        {children}
      </span>
    </div>
  );
}

export default function InventoryPage() {
  const router = useRouter();
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();

  // Same ['store'] queryKey usePOSData.js already uses, so the cache is
  // shared -- reads restaurantMode to decide whether to show the
  // dedicated "Add Menu Item" entry point below.
  const { data: storeResponse } = useQuery({
    queryKey: ['store'],
    queryFn: () => secureApiCall('/api/stores'),
    staleTime: 5 * 60 * 1000
  });
  const restaurantMode = !!storeResponse?.data?.restaurantMode;
  const store = storeResponse?.success && storeResponse?.hasStore ? storeResponse.data : null;
  const [isUpdatingRestaurantMode, setIsUpdatingRestaurantMode] = useState(false);

  // Same endpoint/pattern as StorePreferencesTab's own toggle (Store
  // settings) -- kept here too so switching this on doesn't require
  // leaving the Catalogue page first. Invalidates the shared ['store']
  // query so every other reader (Store settings, POS, DashboardHeader's
  // badge) picks up the change immediately rather than waiting out its
  // own staleTime.
  const handleRestaurantModeChange = async (nextValue) => {
    if (nextValue === restaurantMode || isUpdatingRestaurantMode) return;
    setIsUpdatingRestaurantMode(true);
    try {
      const response = await secureApiCall('/api/stores/restaurant-mode', {
        method: 'PATCH',
        body: JSON.stringify({ restaurantMode: nextValue })
      });
      if (response?.success) {
        queryClient.invalidateQueries({ queryKey: ['store'] });
      }
    } finally {
      setIsUpdatingRestaurantMode(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [sortKey, setSortKey] = useState('productName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { expandedId: expandedItemId, mobileDetailItem, toggleRow: toggleExpanded, closeMobileDetail } = useResponsiveRowExpand();
  const [togglingVisibilityIds, setTogglingVisibilityIds] = useState(new Set());

  // Use TanStack Query for data fetching
  const {
    inventoryData,
    stats,
    isLoading,
    editItem,
    updateStock,
    deleteItem,
    isEditingItem,
    isUpdatingStock,
    isDeletingItem,
    statsError,
    isLoadingStats,
  } = useInventoryData();

  // Storefront's real product-detail URL for a given item -- null while
  // the store's websiteUrl hasn't loaded yet (no website set up at all).
  const storefrontUrl = (item) => (store?.websiteUrl ? `${store.websiteUrl}/product/${item._id}` : null);

  // Debug log when stats change
  useEffect(() => {
    if (stats) {
      console.log('Inventory stats updated:', stats);
    }
    if (statsError) {
      console.error('Inventory stats error:', statsError);
    }
  }, [stats, statsError]);


  const getStockTone = (item) => {
    if (item.quantityInStock === 0) return 'critical';
    if (item.quantityInStock <= item.reorderLevel) return 'low';
    return 'healthy';
  };

  const stockToneStyles = {
    critical: { bar: 'bg-red-500', dot: 'bg-red-500', text: 'text-red-700', track: 'bg-red-100' },
    low: { bar: 'bg-gold-500', dot: 'bg-gold-500', text: 'text-gold-700', track: 'bg-gold-500/15' },
    healthy: { bar: 'bg-brand-700', dot: 'bg-brand-700', text: 'text-brand-800', track: 'bg-brand-100' }
  };

  const getStatusText = (item) => {
    if (item.quantityInStock === 0) return 'Out of stock';
    if (item.quantityInStock <= item.reorderLevel) return 'Low stock';
    return 'In stock';
  };

  // Stock level relative to reorder threshold, for the mini bar-with-track indicator
  const getStockLevelPercent = (item) => {
    const reorder = item.reorderLevel || 0;
    const ceiling = Math.max(reorder * 3, reorder + 5, 5);
    return Math.max(4, Math.min(100, Math.round((item.quantityInStock / ceiling) * 100)));
  };

  const getCurrentDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // Safe stats cards with proper null checks and validation
  const statsCards = stats ? [
    {
      title: 'Total Items',
      description: 'Total unique products',
      value: <CompactMetricValue value={Number(stats.totalItems) || 0} formatValue={(n) => n.toLocaleString('en-NG')} />,
      icon: Package,
      iconBg: 'bg-brand-100',
      iconColor: 'text-brand-800'
    },
    {
      title: 'Low Stock Items',
      description: 'Items below reorder level',
      value: <CompactMetricValue value={Number(stats.lowStockItems) || 0} formatValue={(n) => n.toLocaleString('en-NG')} />,
      icon: AlertTriangle,
      iconBg: 'bg-gold-500/15',
      iconColor: 'text-gold-600'
    },
    {
      title: 'Out of Stock',
      description: 'Items with zero quantity',
      value: <CompactMetricValue value={Number(stats.outOfStockItems) || 0} formatValue={(n) => n.toLocaleString('en-NG')} />,
      icon: XCircle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600'
    },
    {
      title: 'Total Stock Value',
      description: 'Total inventory worth (cost)',
      value: <CompactMetricValue value={Number(stats.totalStockValue) || 0} formatValue={formatCurrency} />,
      icon: ShoppingBag,
      iconBg: 'bg-brand-100',
      iconColor: 'text-brand-800'
    },
    {
      title: 'Expected Revenue',
      description: 'Total selling value if all sold',
      value: <CompactMetricValue value={Number(stats.totalSellingValue) || 0} formatValue={formatCurrency} />,
      icon: TrendingUp,
      iconBg: 'bg-brand-100',
      iconColor: 'text-brand-800'
    }
  ] : [];

  // Handle editing inventory item
  const handleEditItem = async (itemId, itemData) => {
    try {
      const response = await editItem({ itemId, itemData });
      return response;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  };

  // Handle stock update
  const handleStockUpdate = async (itemId, updateData) => {
    try {
      const response = await updateStock({ itemId, updateData });
      return response;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  };

  const handleItemClick = (itemId) => {
    router.push(`/dashboard/inventory/${itemId}`);
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedItem(null);
  };

  const openStockModal = (item) => {
    setSelectedStockItem(item);
    setIsStockModalOpen(true);
  };

  const closeStockModal = () => {
    setIsStockModalOpen(false);
    setSelectedStockItem(null);
  };

  const openDeleteModal = (item) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  // Same PUT endpoint/toggle semantics as WebsiteInventoryView.js's own
  // visibility switch -- kept here too so hiding/showing a product from
  // the storefront doesn't require leaving the Catalogue page first.
  // Patches the ['inventory'] query's cache directly with the value the
  // PUT response already confirms, rather than invalidating and waiting
  // on a second full GET /api/inventory round trip (every item, with
  // variants/batches) just to show the one field that actually changed --
  // that extra round trip was the entire reason this felt slow.
  const handleToggleWebVisibility = async (item) => {
    const currentlyVisible = item.webVisibility !== false;
    setTogglingVisibilityIds(prev => new Set([...prev, item._id]));
    try {
      const response = await secureApiCall(`/api/inventory/${item._id}/web-visibility`, {
        method: 'PUT',
        body: JSON.stringify({ webVisibility: !currentlyVisible })
      });
      if (response?.success) {
        queryClient.setQueryData(['inventory'], (old) =>
          Array.isArray(old)
            ? old.map(i => i._id === item._id ? { ...i, webVisibility: response.data.webVisibility } : i)
            : old
        );
      } else {
        alert('Failed to update visibility. Please try again.');
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Error updating visibility. Please try again.');
    } finally {
      setTogglingVisibilityIds(prev => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const handleDeleteItem = async (reason) => {
    try {
      await deleteItem({ itemId: itemToDelete._id, reason });
      closeDeleteModal();
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  };

  // Get unique categories from inventory data
  const getUniqueCategories = () => {
    const categories = [...new Set(inventoryData.map(item => item.category))];
    return [
      { value: '', label: 'All Categories' },
      ...categories.map(cat => ({ value: cat, label: cat }))
    ];
  };

  // Status filter options
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'in_stock', label: 'In Stock' },
    { value: 'low_stock', label: 'Low Stock' },
    { value: 'out_of_stock', label: 'Out of Stock' }
  ];

  // Get item status for filtering
  const getItemStatus = (item) => {
    if (item.quantityInStock === 0) return 'out_of_stock';
    if (item.quantityInStock <= item.reorderLevel) return 'low_stock';
    return 'in_stock';
  };

  // Filter inventory data — search plus independent, combinable category & status filters
  const filteredInventoryData = useMemo(() => {
    let filtered = inventoryData;

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter(item => getItemStatus(item) === statusFilter);
    }

    return filtered;
  }, [inventoryData, searchTerm, categoryFilter, statusFilter]);

  // Sort the filtered data by the active column
  const sortedInventoryData = useMemo(() => {
    const accessor = SORT_ACCESSORS[sortKey] || SORT_ACCESSORS.productName;
    return [...filteredInventoryData].sort((a, b) => {
      const aVal = accessor(a);
      const bVal = accessor(b);
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredInventoryData, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedInventoryData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedInventoryData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedInventoryData.slice(start, start + pageSize);
  }, [sortedInventoryData, safeCurrentPage, pageSize]);

  // Every mutation that changes the visible result set jumps back to page 1
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (value) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setCategoryFilter('');
    setStatusFilter('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Inventory Management" subtitle={getCurrentDate()}>
        {/* Stats strip Skeleton -- matches the real strip's 2-col mobile
            bento (odd card out spans both columns) */}
        <div className="bg-gray-100 rounded-2xl border border-gray-200 overflow-hidden mb-6 md:mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-px">
            {[1, 2, 3, 4, 5].map((i, index) => (
              <div key={i} className={`p-3 md:p-4 lg:p-5 bg-white animate-pulse ${bentoLastSpanClass(index, 5)}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-gray-200 rounded-lg"></div>
                  <div className="h-3 w-20 bg-gray-200 rounded"></div>
                </div>
                <div className="h-6 md:h-7 w-16 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Primary action Skeleton */}
        <div className="flex justify-end mb-4 md:mb-6">
          <div className="h-9 w-24 md:w-28 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>

        {/* Table Skeleton - Responsive */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Header Skeleton */}
          <div className="p-4 md:p-6 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="h-5 md:h-6 w-32 md:w-48 bg-gray-200 rounded animate-pulse"></div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
                <div className="h-10 w-full sm:w-60 md:w-80 bg-gray-200 rounded-xl animate-pulse"></div>
                <div className="h-10 w-full sm:w-36 md:w-48 bg-gray-200 rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Table Skeleton — same min-width + scroll container as the real table below */}
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50/50">
                <tr>
                  {['Image', 'SKU', 'Name', 'Category', 'Price', 'In Stock', ''].map((header, idx) => (
                    <th key={idx} className="px-6 py-4 text-left">
                      {header && <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                  <tr key={row} className="animate-pulse">
                    {/* Image */}
                    <td className="px-6 py-3">
                      <div className="w-9 h-9 bg-gray-200 rounded-lg flex-shrink-0"></div>
                    </td>
                    {/* SKU */}
                    <td className="px-6 py-3">
                      <div className="h-4 w-16 bg-gray-200 rounded"></div>
                    </td>
                    {/* Name */}
                    <td className="px-6 py-3">
                      <div className="h-4 w-36 bg-gray-200 rounded"></div>
                    </td>
                    {/* Category */}
                    <td className="px-6 py-3">
                      <div className="h-5 w-20 bg-gray-200 rounded-md"></div>
                    </td>
                    {/* Price */}
                    <td className="px-6 py-3">
                      <div className="h-4 w-16 bg-gray-200 rounded ml-auto"></div>
                    </td>
                    {/* Stock */}
                    <td className="px-6 py-3">
                      <div className="h-4 w-10 bg-gray-200 rounded ml-auto"></div>
                    </td>
                    {/* Chevron */}
                    <td className="px-6 py-3">
                      <div className="w-4 h-4 bg-gray-200 rounded"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Skeleton */}
          <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 bg-gray-50">
            <div className="h-3 md:h-4 w-48 md:w-64 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Inventory Management" subtitle={getCurrentDate()}>
      {/* Stats strip -- 2-col bento on mobile; the odd card out spans both
          columns instead of being left alone. Desktop/tablet unchanged. */}
      <div className="bg-gray-100 rounded-2xl border border-gray-200 overflow-hidden mb-6 md:mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-px">
          {statsCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className={`p-3 md:p-4 lg:p-5 bg-white ${bentoLastSpanClass(index, statsCards.length)}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${stat.iconBg} ${stat.iconColor}`}>
                    <IconComponent className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-gray-500">{stat.title}</span>
                </div>
                <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {isLoadingStats ? (
                    <span className="inline-block w-16 h-7 bg-gray-100 animate-pulse rounded"></span>
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">{stat.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary action — outside the catalogue card, between it and the stats strip.
          Restaurant Mode stores get a dedicated menu-first entry point as the
          primary action, plus a smaller secondary one for non-menu items
          (merch, etc.) -- the toggle is non-restrictive, so this never blocks
          the generic flow, just changes which one is emphasized. */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4 md:mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs md:text-sm font-medium text-gray-700 flex items-center gap-1.5">
            Restaurant Mode
            {isUpdatingRestaurantMode && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          </span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={restaurantMode}
              disabled={isUpdatingRestaurantMode}
              onChange={(e) => handleRestaurantModeChange(e.target.checked)}
              className="sr-only peer"
            />
            <span className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-800" />
          </span>
        </label>

        <div className="flex items-center gap-2">
        {restaurantMode && (
          <SplitActionButton
            onAction={() => router.push('/dashboard/inventory/add')}
            pillClassName="rounded-lg md:rounded-xl border border-gray-300"
            actionClassName="flex items-center px-3 py-1.5 md:py-2 text-gray-700 hover:bg-gray-50 text-xs md:text-sm font-medium transition-colors whitespace-nowrap"
            actionContent="Add Other Item"
            infoLabel="What is Add Other Item for?"
            infoTriggerClassName="flex items-center justify-center px-2 border-l border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            Use this for non-menu inventory like drinks, packaged goods, merchandise, or any regular stock item.
          </SplitActionButton>
        )}
        {restaurantMode ? (
          <SplitActionButton
            onAction={() => router.push('/dashboard/inventory/add-menu-item')}
            pillClassName="rounded-lg md:rounded-xl bg-brand-800 hover:bg-brand-900 shadow-sm hover:shadow-md transition-all duration-200"
            actionClassName="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 text-white text-xs md:text-sm font-medium whitespace-nowrap"
            actionContent={
              <>
                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>Add Menu Item</span>
              </>
            }
            infoLabel="What is Add Menu Item for?"
            infoTriggerClassName="flex items-center justify-center px-2 border-l border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            Use this for food menu entries with menu-specific fields like prep details, portions, and extras.
          </SplitActionButton>
        ) : (
          <button
            onClick={() => router.push('/dashboard/inventory/add')}
            className="flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-brand-800 text-white rounded-lg md:rounded-xl hover:bg-brand-900 text-xs md:text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span>Add Item</span>
          </button>
        )}
        </div>
      </div>

      {/* Inventory Overview */}
      <div className="bg-white rounded-xl md:rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-3 md:p-4 lg:p-6 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 md:gap-4">
            <div className="mb-2 lg:mb-0">
              <h2 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900">Catalogue Overview</h2>
              <p className="text-[10px] md:text-xs lg:text-sm text-gray-500 mt-0.5 md:mt-1">Manage your product inventory</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 md:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 md:w-4 md:h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8 md:pl-10 pr-3 md:pr-4 py-1.5 md:py-2 w-full sm:w-48 md:w-64 lg:w-80 bg-gray-50 border-0 rounded-lg md:rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-brand-800 focus:bg-white text-xs md:text-sm transition-all duration-200"
                />
              </div>

              {/* Category filter — independent, combinable with Status */}
              <CustomDropdown
                options={getUniqueCategories()}
                value={categoryFilter}
                onChange={handleCategoryFilterChange}
                className="w-full sm:w-32 md:w-40 lg:w-48"
              />

              {/* Status filter — independent, combinable with Category */}
              <CustomDropdown
                options={statusOptions}
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="w-full sm:w-32 md:w-40 lg:w-48"
              />

              {/* Clear filters button - only show when filters are active */}
              {(categoryFilter || statusFilter || searchTerm) && (
                <button
                  onClick={clearFilters}
                  className="px-2.5 md:px-3 lg:px-4 py-1.5 md:py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {(categoryFilter || statusFilter) && (
            <div className="mt-3 md:mt-4 flex items-center flex-wrap gap-2">
              <span className="text-xs md:text-sm text-gray-500">Active filters:</span>
              {categoryFilter && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-900">
                  Category: {categoryFilter}
                  <button
                    onClick={() => setCategoryFilter('')}
                    className="ml-2 text-brand-800 hover:text-brand-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-900">
                  Status: {statusOptions.find(opt => opt.value === statusFilter)?.label}
                  <button
                    onClick={() => setStatusFilter('')}
                    className="ml-2 text-brand-800 hover:text-brand-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50/80 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-left w-12 md:w-16 text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Image</th>
                <th className="px-3 md:px-4 py-2.5 md:py-4 text-left text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU</th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-left">
                  <button onClick={() => handleSort('productName')} className="flex items-center gap-1 text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900 transition-colors">
                    Name <SortIcon sortKey={sortKey} sortDirection={sortDirection} columnKey="productName" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-left">
                  <button onClick={() => handleSort('category')} className="flex items-center gap-1 text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900 transition-colors">
                    Category <SortIcon sortKey={sortKey} sortDirection={sortDirection} columnKey="category" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                  <button onClick={() => handleSort('price')} className="flex items-center gap-1 ml-auto text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900 transition-colors">
                    Price <SortIcon sortKey={sortKey} sortDirection={sortDirection} columnKey="price" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                  <button onClick={() => handleSort('stock')} className="flex items-center gap-1 ml-auto text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900 transition-colors">
                    In Stock <SortIcon sortKey={sortKey} sortDirection={sortDirection} columnKey="stock" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedInventoryData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      {inventoryData.length === 0 ? (
                        <>
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-900 text-lg font-semibold mb-2">No inventory items yet</p>
                          <p className="text-gray-500 text-sm mb-6">Get started by adding your first product to track</p>
                          <button
                            onClick={() => router.push('/dashboard/inventory/add')}
                            className="flex items-center space-x-2 px-6 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Your First Item</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Filter className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-900 text-lg font-semibold mb-2">No items match your filters</p>
                          <p className="text-gray-500 text-sm mb-6">Try adjusting your search or filter criteria</p>
                          <button
                            onClick={clearFilters}
                            className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            <X className="w-4 h-4" />
                            <span>Clear All Filters</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInventoryData.map((item) => {
                  const tone = getStockTone(item);
                  const toneStyle = stockToneStyles[tone];
                  const margin = getMarginPercent(item);
                  const isExpanded = expandedItemId === item._id;
                  const hasImage = item.image || (item.images && item.images.length > 0);
                  const categoryDetailEntries = item.categoryDetails && typeof item.categoryDetails === 'object'
                    ? Object.entries(item.categoryDetails).filter(([, v]) => v !== null && v !== undefined && v !== '')
                    : [];

                  return (
                    <Fragment key={item._id}>
                      {/* Collapsed row — minimal, single line per column */}
                      <tr
                        onClick={() => toggleExpanded(item._id, item)}
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/80' : ''}`}
                      >
                        <td className="px-3 md:px-6 py-2.5 md:py-3">
                          <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-brand-50 to-brand-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {hasImage ? (
                              <img
                                src={item.image || item.images[0].url}
                                alt={item.productName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <Package className={`w-4 h-4 md:w-5 md:h-5 text-brand-800 ${hasImage ? 'hidden' : ''}`} />
                          </div>
                        </td>
                        <td className="px-3 md:px-4 py-2.5 md:py-3">
                          <span className="text-[10px] md:text-xs font-mono text-gray-500 bg-gray-100 px-1.5 md:px-2 py-0.5 rounded whitespace-nowrap">
                            {item.sku}
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3">
                          <span className="text-xs md:text-sm font-medium text-gray-900 line-clamp-1">{item.productName}</span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3">
                          <span className="inline-flex items-center px-2 md:px-2.5 py-0.5 md:py-1 rounded-md text-[10px] md:text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3 text-right">
                          <span className="text-xs md:text-sm font-semibold text-gray-900 whitespace-nowrap">
                            {formatCurrency(getSellPrice(item))}
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3 text-right">
                          <span className="inline-flex items-center gap-1.5 justify-end whitespace-nowrap">
                            <span className={`w-1.5 h-1.5 rounded-full ${toneStyle.dot}`}></span>
                            <span className="text-xs md:text-sm font-medium text-gray-900">{item.quantityInStock}</span>
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3">
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </td>
                      </tr>

                      {/* Expanded detail panel — bigger image + full breakdown, dropped down instead of forced into the row (desktop only; useResponsiveRowExpand routes this to the mobile Modal below instead) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="7" className="px-4 md:px-8 py-5 md:py-6 bg-gray-50/60 border-b border-gray-100">
                            <ItemDetailContent
                              item={item}
                              margin={margin}
                              hasImage={hasImage}
                              categoryDetailEntries={categoryDetailEntries}
                              formatCurrency={formatCurrency}
                              getStatusText={getStatusText}
                              itemStorefrontUrl={storefrontUrl(item)}
                              store={store}
                              onEdit={openEditModal}
                              onAdjustStock={openStockModal}
                              onViewFullPage={(it) => router.push(`/dashboard/inventory/${it._id}`)}
                              onToggleVisibility={handleToggleWebVisibility}
                              isTogglingVisibility={togglingVisibilityIds.has(item._id)}
                              onDelete={openDeleteModal}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: results summary + pagination */}
        {inventoryData.length > 0 && (
          <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <p className="text-xs md:text-sm text-gray-600">
                  Showing <span className="font-semibold text-gray-900">
                    {sortedInventoryData.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
                    -{Math.min(safeCurrentPage * pageSize, sortedInventoryData.length)}
                  </span> of <span className="font-semibold text-gray-900">{sortedInventoryData.length}</span> items
                  {searchTerm && <span className="text-brand-800"> matching &ldquo;{searchTerm}&rdquo;</span>}
                  {categoryFilter && <span className="text-brand-800"> • Category: {categoryFilter}</span>}
                  {statusFilter && <span className="text-brand-800"> • Status: {statusOptions.find(opt => opt.value === statusFilter)?.label}</span>}
                </p>
                {sortedInventoryData.length > 0 && (
                  <p className="text-xs md:text-sm text-gray-600">
                    Total value: <span className="font-semibold text-gray-900">
                      {formatCurrency(sortedInventoryData.reduce((sum, item) => sum + getStockValue(item), 0))}
                    </span>
                  </p>
                )}
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-2 md:gap-3 flex-nowrap">
                <CustomDropdown
                  options={PAGE_SIZE_OPTIONS.map(n => ({ value: String(n), label: `${n} per page` }))}
                  value={String(pageSize)}
                  onChange={handlePageSizeChange}
                  size="sm"
                  menuPlacement="top"
                  className="w-32 md:w-36 flex-shrink-0"
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs md:text-sm text-gray-600 px-1 whitespace-nowrap">
                    Page <span className="font-semibold text-gray-900">{safeCurrentPage}</span> of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Inventory Modal */}
      <EditInventoryModal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        onSubmit={handleEditItem}
        item={selectedItem}
      />

      {/* Stock Update Modal */}
      <StockUpdateModal
        isOpen={isStockModalOpen}
        onClose={closeStockModal}
        onSubmit={handleStockUpdate}
        item={selectedStockItem}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteItem}
        item={itemToDelete}
        isDeleting={isDeletingItem}
      />

      {/* Mobile row-detail sheet -- same content the desktop inline-expand
          row shows, see useResponsiveRowExpand's own reasoning. */}
      <Modal
        isOpen={!!mobileDetailItem}
        onClose={closeMobileDetail}
        title={mobileDetailItem?.productName || "Item details"}
        icon={Package}
        size="lg"
      >
        {mobileDetailItem && (
          <ItemDetailContent
            item={mobileDetailItem}
            margin={getMarginPercent(mobileDetailItem)}
            hasImage={!!(mobileDetailItem.image || (mobileDetailItem.images && mobileDetailItem.images.length > 0))}
            categoryDetailEntries={
              mobileDetailItem.categoryDetails && typeof mobileDetailItem.categoryDetails === 'object'
                ? Object.entries(mobileDetailItem.categoryDetails).filter(([, v]) => v !== null && v !== undefined && v !== '')
                : []
            }
            formatCurrency={formatCurrency}
            getStatusText={getStatusText}
            itemStorefrontUrl={storefrontUrl(mobileDetailItem)}
            store={store}
            onEdit={(it) => { closeMobileDetail(); openEditModal(it); }}
            onAdjustStock={(it) => { closeMobileDetail(); openStockModal(it); }}
            onViewFullPage={(it) => { closeMobileDetail(); router.push(`/dashboard/inventory/${it._id}`); }}
            onToggleVisibility={handleToggleWebVisibility}
            isTogglingVisibility={togglingVisibilityIds.has(mobileDetailItem._id)}
            onDelete={(it) => { closeMobileDetail(); openDeleteModal(it); }}
          />
        )}
      </Modal>
    </DashboardLayout>
  );
}
