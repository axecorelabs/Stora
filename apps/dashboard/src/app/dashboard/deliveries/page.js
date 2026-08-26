"use client";
import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DeliveryDetailsPanel from "@/components/dashboard/DeliveryDetailsPanel";
import DeliverySettingsCard from "@/components/dashboard/DeliverySettingsCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar,
  Truck,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  DollarSign,
  Eye
} from "lucide-react";

// The DB only allows these five status values (delivery_schedules & delivery_status_history
// CHECK constraints) -- "in_progress" is shown to merchants as "In Transit".
const STATUS_LABELS = {
  scheduled: 'Scheduled',
  in_progress: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Failed'
};

export default function DeliveriesPage() {
  const { secureApiCall } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [deliveries, setDeliveries] = useState([]);
  const [monthDeliveries, setMonthDeliveries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const hasLoadedOnce = useRef(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);

  // Fetch deliveries for selected date
  const fetchDeliveriesForDate = async (date) => {
    try {
      // Format date as YYYY-MM-DD in local timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const response = await secureApiCall(`/api/deliveries?date=${dateStr}`);
      if (response.success) {
        setDeliveries(response.data);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    }
  };

  // Fetch deliveries for current month (for calendar dots)
  const fetchMonthDeliveries = async (date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const response = await secureApiCall(`/api/deliveries?year=${year}&month=${month}`);
      if (response.success) {
        setMonthDeliveries(response.data);
      }
    } catch (error) {
      console.error('Error fetching month deliveries:', error);
    }
  };

  // Fetch delivery stats
  const fetchStats = async () => {
    try {
      const response = await secureApiCall('/api/deliveries/stats');
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching delivery stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      // Only blank out the whole page for the very first load. Every later
      // date/month change (e.g. clicking a calendar day) just refetches in
      // the background -- swapping the whole page for a spinner on every
      // click reads as the page reloading, which it isn't.
      if (!hasLoadedOnce.current) {
        setLoading(true);
      } else {
        setIsRefetching(true);
      }

      await Promise.all([
        fetchDeliveriesForDate(selectedDate),
        fetchMonthDeliveries(currentDate),
        fetchStats()
      ]);

      hasLoadedOnce.current = true;
      setLoading(false);
      setIsRefetching(false);
    };
    loadData();
  }, [selectedDate, currentDate]);

  // Update a delivery's status, then refresh the list/stats and keep the
  // details panel (if open) in sync with the new state
  const updateDeliveryStatus = async (deliveryId, status, notes) => {
    const response = await secureApiCall(`/api/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes })
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to update delivery status');
    }

    setSelectedDelivery(response.data);
    await Promise.all([
      fetchDeliveriesForDate(selectedDate),
      fetchMonthDeliveries(currentDate),
      fetchStats()
    ]);

    return response.data;
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isSameDay = (date1, date2) => {
    return date1.toDateString() === date2.toDateString();
  };

  const isToday = (date) => {
    return isSameDay(date, new Date());
  };

  // Get deliveries count for a specific date - FIXED for timezone issues
  const getDeliveriesCountForDate = (date) => {
    // Convert the calendar date to YYYY-MM-DD format in local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return monthDeliveries.filter(delivery => {
      // Parse the scheduled date and convert to local date string
      const scheduledDate = new Date(delivery.scheduledDate);
      const scheduledYear = scheduledDate.getFullYear();
      const scheduledMonth = String(scheduledDate.getMonth() + 1).padStart(2, '0');
      const scheduledDay = String(scheduledDate.getDate()).padStart(2, '0');
      const scheduledDateStr = `${scheduledYear}-${scheduledMonth}-${scheduledDay}`;
      
      return scheduledDateStr === dateStr;
    }).length;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'text-green-600 bg-green-100';
      case 'scheduled': return 'text-blue-600 bg-blue-100';
      case 'in_progress': return 'text-gold-700 bg-gold-500/15';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered': return CheckCircle;
      case 'scheduled': return Clock;
      case 'in_progress': return Truck;
      case 'failed': return XCircle;
      case 'cancelled': return XCircle;
      default: return Clock;
    }
  };

  // Navigate calendar
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  // Handle date selection
  const handleDateSelect = (day) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(newDate);
  };

  // Handle view delivery details
  const handleViewDetails = (delivery) => {
    setSelectedDelivery(delivery);
    setIsDetailsPanelOpen(true);
  };

  // Close details panel
  const closeDetailsPanel = () => {
    setIsDetailsPanelOpen(false);
    setSelectedDelivery(null);
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (loading) {
    return (
      <DashboardLayout title="Delivery Calendar" subtitle="Manage your delivery schedule">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading delivery calendar...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statsCards = stats ? [
    { title: 'Today', value: stats.todayDeliveries.toString(), icon: Truck, tone: 'brand', description: "Deliveries scheduled today" },
    { title: 'Scheduled', value: stats.scheduledDeliveries.toString(), icon: Clock, tone: 'gold', description: 'Awaiting dispatch' },
    { title: 'Completed', value: stats.completedDeliveries.toString(), icon: CheckCircle, tone: 'brand', description: 'Delivered this month' },
    { title: 'Overdue', value: stats.overdueDeliveries.toString(), icon: AlertTriangle, tone: 'danger', description: 'Past scheduled date' },
    { title: 'Revenue', value: formatCurrency(stats.totalRevenue || 0), icon: DollarSign, tone: 'gold', description: 'From completed deliveries' }
  ] : [];

  return (
    <DashboardLayout title="Delivery Calendar" subtitle="Manage your delivery schedule">
      <DeliverySettingsCard />

      {/* Stats Strip */}
      {stats && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4 lg:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x lg:divide-x divide-gray-100">
            {statsCards.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={index} className="p-4 lg:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                      stat.tone === 'danger' ? 'bg-red-100 text-red-600' :
                      stat.tone === 'gold' ? 'bg-gold-500/15 text-gold-600' : 'bg-brand-100 text-brand-800'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </span>
                    <span className="text-sm text-gray-500">{stat.title}</span>
                  </div>
                  <p className={`text-xl lg:text-2xl font-bold ${stat.tone === 'danger' ? 'text-red-600' : 'text-gray-900'}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{stat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Calendar Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between px-4 lg:px-6 py-4 lg:py-5 bg-gradient-to-r from-brand-50 to-white border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 rounded-xl shrink-0 bg-brand-100 text-brand-800">
                  <Calendar className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg lg:text-xl font-bold text-gray-900">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Select a date to view deliveries</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1.5 text-xs font-semibold bg-brand-800 text-white rounded-lg hover:bg-brand-900 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-4 lg:p-6">
              {/* Weekday labels */}
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                  <div key={idx} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={index} className="aspect-square"></div>;
                  }

                  const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  const deliveriesCount = getDeliveriesCountForDate(cellDate);
                  const isSelected = isSameDay(cellDate, selectedDate);
                  const isTodayDate = isToday(cellDate);
                  const isWeekend = index % 7 === 0 || index % 7 === 6;

                  return (
                    <button
                      key={index}
                      onClick={() => handleDateSelect(day)}
                      className={`aspect-square flex flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isSelected
                          ? 'bg-brand-800 text-white shadow-md shadow-brand-800/25'
                          : isTodayDate
                          ? 'bg-white text-brand-900 font-bold ring-2 ring-inset ring-brand-800'
                          : deliveriesCount > 0
                          ? 'bg-brand-50 text-gray-900 hover:bg-brand-100'
                          : isWeekend
                          ? 'text-gray-400 hover:bg-gray-50'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{day}</span>
                      {deliveriesCount > 0 && (
                        <span className={`text-[10px] leading-none px-1.5 py-0.5 rounded-full font-semibold ${
                          isSelected ? 'bg-white/25 text-white' : 'bg-brand-800 text-white'
                        }`}>
                          {deliveriesCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center flex-wrap gap-x-5 gap-y-2 mt-5 pt-4 border-t border-gray-100">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-md ring-2 ring-inset ring-brand-800 bg-white"></span>
                  Today
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-md bg-brand-50"></span>
                  Has deliveries
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-md bg-brand-800"></span>
                  Selected
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Date Deliveries - Minimalistic */}
        <div>
          <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100 sticky top-6">
            <div className="flex items-center justify-between mb-4 lg:mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  {selectedDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                  {isRefetching && (
                    <span className="w-3.5 h-3.5 border-2 border-brand-800 border-t-transparent rounded-full animate-spin" />
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {deliveries.length} {deliveries.length === 1 ? 'delivery' : 'deliveries'}
                </p>
              </div>
              <span className="px-3 py-1.5 bg-brand-100 text-brand-900 text-sm font-bold rounded-lg">
                {deliveries.length}
              </span>
            </div>

            <div className={`space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar transition-opacity ${isRefetching ? 'opacity-50' : ''}`}>
              {deliveries.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No deliveries</p>
                  <p className="text-xs text-gray-400 mt-1">Select another date</p>
                </div>
              ) : (
                deliveries.map((delivery) => {
                  const StatusIcon = getStatusIcon(delivery.status);
                  return (
                    <div 
                      key={delivery._id}
                      className="border border-gray-100 rounded-xl p-3 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer"
                      onClick={() => handleViewDetails(delivery)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${getStatusColor(delivery.status)}`}>
                          {STATUS_LABELS[delivery.status] || delivery.status}
                        </span>
                        <Eye className="w-4 h-4 text-gray-400" />
                      </div>

                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        {delivery.customer.name}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <span className="text-xs text-gray-500">
                          {delivery.items.length} items
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(delivery.totalAmount)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Details Panel */}
      <DeliveryDetailsPanel
        isOpen={isDetailsPanelOpen}
        onClose={closeDetailsPanel}
        delivery={selectedDelivery}
        onStatusUpdate={updateDeliveryStatus}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </DashboardLayout>
  );
}
