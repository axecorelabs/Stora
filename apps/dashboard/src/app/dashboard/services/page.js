"use client";
import { Fragment, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import AddServiceModal from "@/components/dashboard/AddServiceModal";
import StoreServicesTab from "@/components/dashboard/store/StoreServicesTab";
import Button from "@/components/ui/Button";
import CustomDropdown from "@/components/ui/CustomDropdown";
import Modal from "@/components/ui/Modal";
import useResponsiveRowExpand from "@/hooks/useResponsiveRowExpand";
import { bentoLastSpanClass } from "@/lib/statsBento";
import {
  Wrench,
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Tag,
  X
} from "lucide-react";

function normalizeListingPriceList(raw) {
  if (!raw) return [];
  const source = Array.isArray(raw) ? raw : Array.isArray(raw.items) ? raw.items : [];

  return source
    .map((item) => {
      if (!item) return null;

      if (typeof item === "string") {
        const title = item.trim();
        return title ? { title, price: "", from: false, note: "" } : null;
      }

      const title = (item.title || item.name || item.label || "").trim();
      if (!title) return null;

      const rawPrice = item.price ?? item.amount ?? item.value ?? item.minPrice;
      const price = rawPrice === null || rawPrice === undefined || rawPrice === ""
        ? ""
        : String(rawPrice).replace(/[^\d.-]/g, "");

      return {
        title,
        price,
        from: Boolean(item.from || item.isFrom || item.minPrice),
        note: (item.note || "").trim()
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function sanitizeListingPriceList(list) {
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      const title = (item?.title || "").trim();
      if (!title) return null;

      const rawPrice = item?.price;
      const numericPrice = rawPrice === null || rawPrice === undefined || rawPrice === ""
        ? null
        : Number(String(rawPrice).replace(/[^\d.-]/g, ""));

      return {
        title,
        price: Number.isFinite(numericPrice) ? numericPrice : null,
        from: Boolean(item?.from),
        note: (item?.note || "").trim() || null
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

const WEEK_DAYS = [
  { day: 'monday', label: 'M' },
  { day: 'tuesday', label: 'T' },
  { day: 'wednesday', label: 'W' },
  { day: 'thursday', label: 'T' },
  { day: 'friday', label: 'F' },
  { day: 'saturday', label: 'S' },
  { day: 'sunday', label: 'S' }
];

const DURATION_UNIT_LABEL = {
  minutes: ['min', 'mins'],
  hours: ['hour', 'hours'],
  days: ['day', 'days']
};

// Trusts durationUnit directly rather than guessing from the raw number --
// the old version branched on `minutes < 60` regardless of unit, so a
// 2-hour service (duration: 2, durationUnit: 'hours') displayed as "2
// mins".
function formatDuration(duration, durationUnit = 'minutes') {
  if (duration == null) return 'Not set';
  const [singular, plural] = DURATION_UNIT_LABEL[durationUnit] || DURATION_UNIT_LABEL.minutes;
  return `${duration} ${duration === 1 ? singular : plural}`;
}

// Small week-at-a-glance strip -- every service item already stores which
// days it's available, but nothing on this page ever showed it, so a
// vendor had to open Edit just to check. Filled brand dot = available.
function AvailabilityStrip({ availability }) {
  const byDay = Object.fromEntries((availability || []).map((a) => [a.day, a.isAvailable]));
  return (
    <div className="flex items-center gap-1" title="Weekly availability">
      {WEEK_DAYS.map(({ day, label }, i) => (
        <span
          key={`${day}-${i}`}
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold ${
            byDay[day] ? 'bg-brand-800 text-white' : 'bg-gray-100 text-gray-300'
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

// Shared by the desktop inline expanded row and the mobile detail Modal so
// the two never drift into different feature sets.
function ServiceDetailContent({ serviceItem, hasImage, formatCurrency, getCoverageLabel, onEdit, onDelete, isDeleting }) {
  return (
    <div className="flex flex-col sm:flex-row gap-5 md:gap-8">
      <div className="w-full sm:w-40 md:w-44 h-40 md:h-44 flex-shrink-0 bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl flex items-center justify-center overflow-hidden mx-auto sm:mx-0">
        {hasImage ? (
          <img src={serviceItem.portfolioImages[0]} alt={serviceItem.name} className="w-full h-full object-cover" />
        ) : (
          <Wrench className="w-12 h-12 text-brand-800" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 md:gap-y-4">
          <div>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Category</p>
            <p className="text-xs md:text-sm font-medium text-gray-900">{serviceItem.category || 'Uncategorized'}</p>
          </div>
          <div>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Sub-category</p>
            <p className="text-xs md:text-sm font-medium text-gray-900">{serviceItem.subCategory || 'Not set'}</p>
          </div>
          <div>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Duration</p>
            <p className="text-xs md:text-sm font-medium text-gray-900">{formatDuration(serviceItem.duration, serviceItem.durationUnit)}</p>
          </div>
          <div>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Price</p>
            <p className="text-xs md:text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(serviceItem.price)}</p>
          </div>
          <div>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Coverage</p>
            <p className="text-xs md:text-sm font-medium text-gray-900">{getCoverageLabel(serviceItem)}</p>
          </div>
          <div>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Home Service</p>
            <p className="text-xs md:text-sm font-medium text-gray-900">{serviceItem.homeServiceAvailable ? 'Available' : 'Not available'}</p>
          </div>
          <div>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Max bookings/day</p>
            <p className="text-xs md:text-sm font-medium text-gray-900">{serviceItem.maxBookingsPerDay || 'Not set'}</p>
          </div>
          <div>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Experience</p>
            <p className="text-xs md:text-sm font-medium text-gray-900">{serviceItem.yearsOfExperience > 0 ? `${serviceItem.yearsOfExperience}+ yrs` : 'Not set'}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Weekly Availability</p>
          <AvailabilityStrip availability={serviceItem.availability} />
        </div>

        {serviceItem.description && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-xs md:text-sm text-gray-700">{serviceItem.description}</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onEdit(serviceItem)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit service
          </button>
          <button
            onClick={() => onDelete(serviceItem._id)}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const { secureApiCall } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [service, setService] = useState(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [storeProfile, setStoreProfile] = useState(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  // The specific item being edited, or null when the modal is adding a new
  // one -- previously this passed the whole { services: [...] } document as
  // `existingService`, a shape AddServiceModal never actually read, so
  // "Edit" was wired up to nothing.
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const { expandedId: expandedServiceId, mobileDetailItem: mobileDetailService, toggleRow: toggleExpandedService, closeMobileDetail } = useResponsiveRowExpand();
  const [isEditingPriceList, setIsEditingPriceList] = useState(false);
  const [priceListDraft, setPriceListDraft] = useState([]);
  const [priceListError, setPriceListError] = useState('');
  const [isSavingPriceList, setIsSavingPriceList] = useState(false);

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

  const fetchServices = async () => {
    try {
      const data = await secureApiCall('/api/services');
      if (data.success) {
        setService(data.data); // data.data will be the service object or null
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchStoreProfile = async () => {
    try {
      const response = await secureApiCall('/api/stores');
      if (response.success && response.hasStore) {
        setStoreProfile(response.data);
        setPriceListDraft(normalizeListingPriceList(response.data?.onlineStoreInfo?.priceList));
      }
    } catch (error) {
      console.error('Error fetching store profile:', error);
    } finally {
      setLoadingStore(false);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchStoreProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetPriceList = (next) => {
    setPriceListDraft(next);
    if (priceListError) setPriceListError('');
  };

  const saveListingPriceList = async () => {
    const hasInvalidPartial = priceListDraft.some((item) => {
      const title = (item?.title || '').trim();
      const price = `${item?.price ?? ''}`.trim();
      const note = (item?.note || '').trim();
      return !title && (price || note);
    });

    if (hasInvalidPartial) {
      setPriceListError('Each service row with a price or note must include a service name.');
      return;
    }

    const sanitized = sanitizeListingPriceList(priceListDraft);
    const nextUpdatedAt = sanitized.length > 0 ? new Date().toISOString() : null;

    setIsSavingPriceList(true);
    try {
      const response = await secureApiCall('/api/stores', {
        method: 'PUT',
        body: JSON.stringify({
          onlineStoreInfo: {
            ...(storeProfile?.onlineStoreInfo || {}),
            priceList: sanitized,
            priceListUpdatedAt: nextUpdatedAt
          }
        })
      });

      if (response.success) {
        setStoreProfile(response.data);
        setPriceListDraft(normalizeListingPriceList(response.data?.onlineStoreInfo?.priceList));
        setIsEditingPriceList(false);
        setPriceListError('');
      } else {
        setPriceListError(response.message || 'Failed to save price list.');
      }
    } catch (error) {
      setPriceListError(error.message || 'Failed to save price list.');
    } finally {
      setIsSavingPriceList(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Delete this service? This cannot be undone.')) return;
    setDeletingItemId(itemId);
    try {
      const data = await secureApiCall(`/api/services/items/${itemId}`, { method: 'DELETE' });
      if (data.success) {
        setService(data.data);
      } else {
        alert(data.error || data.message || 'Failed to delete service');
      }
    } catch (error) {
      alert(error.message || 'Failed to delete service');
    } finally {
      setDeletingItemId(null);
    }
  };

  const allServices = service?.services || [];

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...[...new Set(allServices.map((s) => s.category).filter(Boolean))].map((cat) => ({ value: cat, label: cat }))
  ];

  const statsCards = [
    {
      title: 'Total Services',
      value: allServices.length.toString(),
      description: 'Listed on your storefront',
      icon: Wrench,
      iconBg: 'bg-brand-100',
      iconColor: 'text-brand-800'
    },
    {
      title: 'Categories',
      value: new Set(allServices.map((s) => s.category).filter(Boolean)).size.toString(),
      description: 'Distinct service categories',
      icon: Tag,
      iconBg: 'bg-gold-500/15',
      iconColor: 'text-gold-600'
    },
    {
      title: 'Average Price',
      value: allServices.length > 0
        ? formatCurrency(allServices.reduce((sum, s) => sum + (s.price || 0), 0) / allServices.length)
        : formatCurrency(0),
      description: 'Across all services',
      icon: Wrench,
      iconBg: 'bg-brand-100',
      iconColor: 'text-brand-800'
    }
  ];

  const filteredServices = allServices.filter((item) => {
    const matchesSearch =
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
  };

  const getCoverageLabel = (serviceItem) => {
    if (serviceItem.serviceLocations?.coverAllNigeria) return 'Nationwide';
    const states = serviceItem.serviceLocations?.states?.length || 0;
    return `${states} state${states === 1 ? '' : 's'}`;
  };

  if (loadingServices || loadingStore) {
    return (
      <DashboardLayout title="Services Management" subtitle={getCurrentDate()}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading services...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isListingMode = storeProfile?.platformMode === 'listing';

  if (isListingMode) {
    return (
      <DashboardLayout title="Services and Price List" subtitle="Manage what appears on your showcase">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-gray-900">Public Services</h2>
              <p className="text-sm text-gray-500 mt-0.5">This content appears directly on your public listing showcase.</p>
            </div>

            {!isEditingPriceList ? (
              <Button variant="primary" onClick={() => setIsEditingPriceList(true)}>
                <Edit className="w-4 h-4" />
                <span>Edit services</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPriceListDraft(normalizeListingPriceList(storeProfile?.onlineStoreInfo?.priceList));
                    setPriceListError('');
                    setIsEditingPriceList(false);
                  }}
                  disabled={isSavingPriceList}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={saveListingPriceList} disabled={isSavingPriceList}>
                  {isSavingPriceList ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            )}
          </div>

          <StoreServicesTab
            store={storeProfile}
            isEditing={isEditingPriceList}
            editData={{
              onlineStoreInfo: {
                priceList: priceListDraft,
                priceListUpdatedAt: storeProfile?.onlineStoreInfo?.priceListUpdatedAt || null
              }
            }}
            setPriceList={handleSetPriceList}
            errors={priceListError ? { 'onlineStoreInfo.priceList': priceListError } : {}}
          />
        </div>
      </DashboardLayout>
    );
  }

  const EmptyState = ({ hasAnyServices }) => (
    <div className="flex flex-col items-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Wrench className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-gray-900 text-lg font-semibold mb-2">
        {hasAnyServices ? 'No services match your filters' : 'No services yet'}
      </p>
      <p className="text-gray-500 text-sm mb-6 max-w-sm">
        {hasAnyServices
          ? 'Try a different search term or clear the category filter.'
          : 'List a bookable or contactable service -- pricing, availability, and where you cover -- so shoppers can find and reach you.'}
      </p>
      {hasAnyServices ? (
        <Button variant="secondary" onClick={clearFilters}>
          <X className="w-4 h-4" />
          <span>Clear filters</span>
        </Button>
      ) : (
        <Button variant="primary" onClick={() => { setEditingItem(null); setIsAddServiceModalOpen(true); }}>
          <Plus className="w-4 h-4" />
          <span>Add Your First Service</span>
        </Button>
      )}
    </div>
  );

  return (
    <DashboardLayout title="Services Management" subtitle={getCurrentDate()}>
      {/* Stats strip -- 2-col bento on mobile; the odd card out spans both
          columns instead of being left alone. Desktop/tablet unchanged. */}
      <div className="bg-gray-100 rounded-2xl border border-gray-200 overflow-hidden mb-6 md:mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px">
          {statsCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className={`p-5 bg-white ${bentoLastSpanClass(index, statsCards.length)}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${stat.iconBg} ${stat.iconColor}`}>
                    <IconComponent className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-gray-500">{stat.title}</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {stat.value}
                </p>
                <p className="text-xs text-gray-400 mt-1">{stat.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Services Overview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="font-display text-lg lg:text-xl font-semibold text-gray-900">Services Overview</h2>
              <p className="text-xs lg:text-sm text-gray-500 mt-0.5">Manage what you offer, from pricing to availability</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full sm:w-48 md:w-56 bg-gray-50 border-0 rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-brand-800 focus:bg-white text-sm transition-all duration-200"
                />
              </div>

              <CustomDropdown
                options={categoryOptions}
                value={categoryFilter}
                onChange={setCategoryFilter}
                className="w-full sm:w-40 md:w-48"
              />

              <Button
                variant="primary"
                onClick={() => { setEditingItem(null); setIsAddServiceModalOpen(true); }}
                className="whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Service</span>
              </Button>
            </div>
          </div>

          {(searchTerm || categoryFilter) && (
            <div className="mt-4 flex items-center flex-wrap gap-2">
              <span className="text-xs md:text-sm text-gray-500">Active filters:</span>
              {categoryFilter && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-900">
                  Category: {categoryFilter}
                  <button onClick={() => setCategoryFilter('')} className="ml-2 text-brand-800 hover:text-brand-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-900">
                  &ldquo;{searchTerm}&rdquo;
                  <button onClick={() => setSearchTerm('')} className="ml-2 text-brand-800 hover:text-brand-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-gray-50/80 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-left text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Service</th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-left text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-left text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-right text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 text-right text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Coverage</th>
                <th className="px-3 md:px-6 py-2.5 md:py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <EmptyState hasAnyServices={allServices.length > 0} />
                  </td>
                </tr>
              ) : (
                filteredServices.map((serviceItem, index) => {
                  const itemId = serviceItem._id || String(index);
                  const hasImage = Array.isArray(serviceItem.portfolioImages) && serviceItem.portfolioImages.length > 0;
                  const isExpanded = expandedServiceId === itemId;

                  return (
                    <Fragment key={itemId}>
                      <tr
                        onClick={() => toggleExpandedService(itemId, serviceItem)}
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/80' : ''}`}
                      >
                        <td className="px-3 md:px-6 py-2.5 md:py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg overflow-hidden bg-gradient-to-br from-brand-50 to-brand-100 flex-shrink-0 flex items-center justify-center">
                              {hasImage ? (
                                <img src={serviceItem.portfolioImages[0]} alt={serviceItem.name} className="w-full h-full object-cover" />
                              ) : (
                                <Wrench className="w-4 h-4 md:w-5 md:h-5 text-brand-800" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs md:text-sm font-medium text-gray-900 line-clamp-1">{serviceItem.name}</div>
                              <div className="text-[11px] md:text-xs text-gray-500 line-clamp-1">{serviceItem.description || 'No description yet.'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3">
                          <span className="inline-flex items-center px-2 md:px-2.5 py-0.5 rounded-md text-[10px] md:text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                            {serviceItem.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3">
                          <span className="text-xs md:text-sm text-gray-700 whitespace-nowrap">{formatDuration(serviceItem.duration, serviceItem.durationUnit)}</span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3 text-right">
                          <span className="text-xs md:text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{formatCurrency(serviceItem.price)}</span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3 text-right">
                          <span className="text-xs md:text-sm text-gray-700 whitespace-nowrap">{getCoverageLabel(serviceItem)}</span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-3">
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-gray-400 ml-auto" />
                            : <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan="6" className="px-4 md:px-8 py-5 md:py-6 bg-gray-50/60 border-b border-gray-100">
                            <ServiceDetailContent
                              serviceItem={serviceItem}
                              hasImage={hasImage}
                              formatCurrency={formatCurrency}
                              getCoverageLabel={getCoverageLabel}
                              onEdit={(item) => { setEditingItem(item); setIsAddServiceModalOpen(true); }}
                              onDelete={handleDelete}
                              isDeleting={deletingItemId === serviceItem._id}
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

        {/* Results Summary */}
        {filteredServices.length > 0 && (
          <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/60">
            <p className="text-sm text-gray-500">
              Showing {filteredServices.length} of {allServices.length} service{allServices.length === 1 ? '' : 's'}
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Service Modal */}
      {isAddServiceModalOpen && (
        <AddServiceModal
          isOpen={isAddServiceModalOpen}
          onClose={() => { setIsAddServiceModalOpen(false); setEditingItem(null); }}
          onSaved={(updatedDoc) => { setService(updatedDoc); setEditingItem(null); }}
          existingService={editingItem}
        />
      )}

      {/* Mobile detail sheet — same content the desktop inline row shows */}
      <Modal
        isOpen={!!mobileDetailService}
        onClose={closeMobileDetail}
        title={mobileDetailService?.name || "Service details"}
        icon={Wrench}
      >
        {mobileDetailService && (
          <ServiceDetailContent
            serviceItem={mobileDetailService}
            hasImage={Array.isArray(mobileDetailService.portfolioImages) && mobileDetailService.portfolioImages.length > 0}
            formatCurrency={formatCurrency}
            getCoverageLabel={getCoverageLabel}
            onEdit={(item) => { closeMobileDetail(); setEditingItem(item); setIsAddServiceModalOpen(true); }}
            onDelete={(itemId) => { closeMobileDetail(); handleDelete(itemId); }}
            isDeleting={deletingItemId === mobileDetailService._id}
          />
        )}
      </Modal>
    </DashboardLayout>
  );
}
