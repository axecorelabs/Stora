"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, MapPin, Truck, ChevronLeft, ChevronRight, Phone } from "lucide-react";

export default function ScheduleCard({ deliveries = [] }) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

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

  // Get deliveries for a specific date
  const getDeliveriesForDate = (date) => {
    return deliveries.filter(delivery => {
      const deliveryDate = new Date(delivery.scheduledDate);
      return isSameDay(deliveryDate, date);
    });
  };

  // Get deliveries count for a date
  const getDeliveriesCountForDate = (date) => {
    return getDeliveriesForDate(date).length;
  };

  // Navigate month
  const navigateMonth = (direction) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  // Handle date selection
  const handleDateSelect = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
  };

  // Navigate to deliveries page
  const handleViewAllDeliveries = () => {
    router.push('/dashboard/deliveries');
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
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

  // Format time
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get time slot display text
  const getTimeSlotText = (slot) => {
    const slots = {
      'morning': '8AM-12PM',
      'afternoon': '12PM-5PM',
      'evening': '5PM-8PM',
      'anytime': 'Anytime'
    };
    return slots[slot] || 'Anytime';
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'in_transit': return 'bg-orange-100 text-orange-700';
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-gray-100 text-gray-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const calendarDays = generateCalendarDays();
  const selectedDateDeliveries = getDeliveriesForDate(selectedDate);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="lg:col-span-4">
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <Calendar className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delivery Schedule</h3>
              <p className="text-xs text-gray-500">Upcoming deliveries</p>
            </div>
          </div>
          <button
            onClick={handleViewAllDeliveries}
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            View All
          </button>
        </div>

        {/* Mini Calendar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h4>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => navigateMonth(1)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={index} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={index} className="aspect-square"></div>;
              }

              const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              const deliveriesCount = getDeliveriesCountForDate(cellDate);
              const isSelected = isSameDay(cellDate, selectedDate);
              const isTodayDate = isToday(cellDate);

              return (
                <button
                  key={index}
                  onClick={() => handleDateSelect(day)}
                  className={`aspect-square text-xs font-medium rounded-lg transition-all relative flex items-center justify-center ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-md'
                      : isTodayDate
                      ? 'bg-teal-100 text-teal-800 border-2 border-teal-300'
                      : deliveriesCount > 0
                      ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {day}
                  {deliveriesCount > 0 && (
                    <div className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] text-[9px] font-bold rounded-full flex items-center justify-center ${
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

        {/* Selected Date Deliveries */}
        <div>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900">
              {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </h4>
            <span className="text-xs text-gray-500">
              {selectedDateDeliveries.length} {selectedDateDeliveries.length === 1 ? 'delivery' : 'deliveries'}
            </span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
            {selectedDateDeliveries.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No deliveries scheduled</p>
              </div>
            ) : (
              selectedDateDeliveries.map((delivery) => (
                <div 
                  key={delivery._id}
                  className="border border-gray-100 rounded-xl p-3 hover:border-teal-200 hover:bg-teal-50/30 transition-all cursor-pointer"
                  onClick={handleViewAllDeliveries}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-teal-100 rounded-lg">
                        <Truck className="w-3.5 h-3.5 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">
                          {delivery.customer.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getTimeSlotText(delivery.timeSlot)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${getStatusColor(delivery.status)}`}>
                      {delivery.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-gray-600 mb-2">
                    <MapPin className="w-3 h-3" />
                    <span className="line-clamp-1">{delivery.deliveryAddress.city}, {delivery.deliveryAddress.state}</span>
                  </div>

                  {delivery.customer.phone && (
                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                      <Phone className="w-3 h-3" />
                      <span>{delivery.customer.phone}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
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
    </div>
  );
}
