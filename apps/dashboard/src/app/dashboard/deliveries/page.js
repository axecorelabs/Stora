"use client";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DeliveryDetailsPanel from "@/components/dashboard/DeliveryDetailsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Calendar, 
  Truck, 
  Clock, 
  MapPin, 
  Phone, 
  Package,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  User,
  Eye
} from "lucide-react";

export default function DeliveriesPage() {
  const { secureApiCall } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [deliveries, setDeliveries] = useState([]);
  const [monthDeliveries, setMonthDeliveries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(true);
      await Promise.all([
        fetchDeliveriesForDate(selectedDate),
        fetchMonthDeliveries(currentDate),
        fetchStats()
      ]);
      setLoading(false);
    };
    loadData();
  }, [selectedDate, currentDate]);

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
      case 'in_transit': return 'text-orange-600 bg-orange-100';
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
      case 'in_transit': return Truck;
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading delivery calendar...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Delivery Calendar" subtitle="Manage your delivery schedule">
      {/* Stats Cards - Minimalistic */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayDeliveries}</p>
              </div>
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">{stats.scheduledDeliveries}</p>
              </div>
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedDeliveries}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdueDeliveries}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Section - Minimalistic */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Select a date to view deliveries</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={idx} className="p-2 text-center text-xs font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={index} className="aspect-square"></div>;
                }

                const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const deliveriesCount = getDeliveriesCountForDate(cellDate);
                const isSelected = isSameDay(cellDate, selectedDate);
                const isTodayDate = isToday(cellDate);

                return (
                  <button
                    key={index}
                    onClick={() => handleDateSelect(day)}
                    className={`aspect-square p-2 text-sm font-medium rounded-lg transition-all relative flex items-center justify-center ${
                      isSelected
                        ? 'bg-teal-600 text-white'
                        : isTodayDate
                        ? 'bg-teal-100 text-teal-800 border border-teal-300'
                        : deliveriesCount > 0
                        ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {day}
                    {deliveriesCount > 0 && (
                      <div className={`absolute -top-1 -right-1 w-4 h-4 text-xs font-bold rounded-full flex items-center justify-center ${
                        isSelected 
                          ? 'bg-white text-teal-600' 
                          : 'bg-teal-600 text-white'
                      }`}>
                        {deliveriesCount}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Date Deliveries - Minimalistic */}
        <div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 sticky top-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {selectedDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {deliveries.length} {deliveries.length === 1 ? 'delivery' : 'deliveries'}
                </p>
              </div>
              <span className="px-3 py-1.5 bg-teal-100 text-teal-700 text-sm font-bold rounded-lg">
                {deliveries.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
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
                      className="border border-gray-100 rounded-xl p-3 hover:border-teal-200 hover:bg-teal-50/30 transition-all cursor-pointer"
                      onClick={() => handleViewDetails(delivery)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${getStatusColor(delivery.status)}`}>
                          {delivery.status.replace('_', ' ')}
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
