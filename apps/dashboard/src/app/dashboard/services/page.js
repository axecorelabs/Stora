"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import AddServiceModal from "@/components/dashboard/AddServiceModal";
import Button from "@/components/ui/Button";
import CustomDropdown from "@/components/ui/CustomDropdown";
import {
  Wrench,
  Plus,
  Search,
  Edit,
  Trash2,
  Grid3x3,
  List,
  Clock,
  MapPin,
  Tag,
  X
} from "lucide-react";

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

export default function ServicesPage() {
  const { secureApiCall } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  // The specific item being edited, or null when the modal is adding a new
  // one -- previously this passed the whole { services: [...] } document as
  // `existingService`, a shape AddServiceModal never actually read, so
  // "Edit" was wired up to nothing.
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (loading) {
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
      {/* Stats strip */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 md:mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {statsCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="p-5">
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

              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1 self-start sm:self-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-brand-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-brand-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

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

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="p-4 md:p-6">
            {filteredServices.length === 0 ? (
              <EmptyState hasAnyServices={allServices.length > 0} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
                {filteredServices.map((serviceItem, index) => (
                  <div
                    key={serviceItem._id || index}
                    className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {/* Image -- padded inset framing, same card language ProductCard.js
                        (apps/store) uses for the shopper-facing equivalent of this
                        card, so a vendor's dashboard preview and the real storefront
                        read as one consistent visual system. */}
                    <div className="p-3">
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-brand-50">
                        {serviceItem.portfolioImages && serviceItem.portfolioImages.length > 0 ? (
                          <img
                            src={serviceItem.portfolioImages[0]}
                            alt={serviceItem.name}
                            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Wrench className="w-10 h-10 text-brand-200" strokeWidth={1.5} />
                          </div>
                        )}

                        {serviceItem.homeServiceAvailable && (
                          <div className="absolute top-2.5 left-2.5 bg-green-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                            Home service
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-brand-50 text-brand-800 truncate">
                          {serviceItem.category || 'Uncategorized'}
                        </span>
                        {serviceItem.yearsOfExperience > 0 && (
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">{serviceItem.yearsOfExperience}+ yrs</span>
                        )}
                      </div>

                      <h3 className="text-[15px] font-semibold text-gray-900 mb-1 line-clamp-1">
                        {serviceItem.name}
                      </h3>
                      {serviceItem.subCategory && (
                        <p className="text-xs text-gray-400 mb-2">{serviceItem.subCategory}</p>
                      )}
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                        {serviceItem.description || 'No description yet.'}
                      </p>

                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(serviceItem.duration, serviceItem.durationUnit)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {serviceItem.serviceLocations?.coverAllNigeria
                            ? 'Nationwide'
                            : `${serviceItem.serviceLocations?.states?.length || 0} state${serviceItem.serviceLocations?.states?.length === 1 ? '' : 's'}`}
                        </span>
                      </div>

                      <div className="mb-3">
                        <AvailabilityStrip availability={serviceItem.availability} />
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div>
                          <div className="text-base font-bold text-gray-900 tabular-nums">
                            {formatCurrency(serviceItem.price)}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            Max {serviceItem.maxBookingsPerDay || '—'}/day
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingItem(serviceItem); setIsAddServiceModalOpen(true); }}
                            className="p-2 text-gray-400 hover:text-brand-800 hover:bg-brand-50 rounded-lg transition-all"
                            title="Edit service"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(serviceItem._id)}
                            disabled={deletingItemId === serviceItem._id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                            title="Delete service"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* List View (Table) */}
        {viewMode === 'list' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Service</th>
                  <th className="px-4 md:px-6 py-3 text-left text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                  <th className="px-4 md:px-6 py-3 text-left text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                  <th className="px-4 md:px-6 py-3 text-right text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                  <th className="px-4 md:px-6 py-3 text-right text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Max/Day</th>
                  <th className="px-4 md:px-6 py-3 text-left text-[10px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">Home Service</th>
                  <th className="px-4 md:px-6 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <EmptyState hasAnyServices={allServices.length > 0} />
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((serviceItem, index) => (
                    <tr key={serviceItem._id || index} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 md:px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-brand-50 to-brand-100 flex-shrink-0 flex items-center justify-center">
                            {serviceItem.portfolioImages && serviceItem.portfolioImages.length > 0 ? (
                              <img src={serviceItem.portfolioImages[0]} alt={serviceItem.name} className="w-full h-full object-cover" />
                            ) : (
                              <Wrench className="w-5 h-5 text-brand-800" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{serviceItem.name}</div>
                            <div className="text-xs text-gray-500 truncate max-w-xs">{serviceItem.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-brand-50 text-brand-800">
                          {serviceItem.category || 'Uncategorized'}
                        </span>
                        {serviceItem.subCategory && (
                          <div className="text-xs text-gray-400 mt-1">{serviceItem.subCategory}</div>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3">
                        <span className="text-sm text-gray-700">{formatDuration(serviceItem.duration, serviceItem.durationUnit)}</span>
                      </td>
                      <td className="px-4 md:px-6 py-3 text-right">
                        <div className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(serviceItem.price)}</div>
                      </td>
                      <td className="px-4 md:px-6 py-3 text-right">
                        <span className="text-sm text-gray-700 tabular-nums">{serviceItem.maxBookingsPerDay || '—'}</span>
                      </td>
                      <td className="px-4 md:px-6 py-3">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                          serviceItem.homeServiceAvailable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {serviceItem.homeServiceAvailable ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingItem(serviceItem); setIsAddServiceModalOpen(true); }}
                            className="p-1.5 text-gray-400 hover:text-brand-800 hover:bg-brand-50 rounded-lg transition-all"
                            title="Edit service"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(serviceItem._id)}
                            disabled={deletingItemId === serviceItem._id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                            title="Delete service"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

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
    </DashboardLayout>
  );
}
