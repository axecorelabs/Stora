"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import AddServiceModal from "@/components/dashboard/AddServiceModal";
import { 
  Wrench,
  Plus,
  Search,
  Edit,
  Eye,
  MoreHorizontal,
  Filter,
  Grid3x3,
  List,
  Clock,
  MapPin,
  Tag
} from "lucide-react";

export default function ServicesPage() {
  const { secureApiCall } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [storeData, setStoreData] = useState(null);
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

  useEffect(() => {
    fetchUserData();
    fetchStoreData();
    fetchServices();
  }, []);

  const fetchUserData = async () => {
    try {
      const data = await secureApiCall('/api/auth/me');
      if (data.success) {
        setUserData(data.user);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchStoreData = async () => {
    try {
      const data = await secureApiCall('/api/stores');
      if (data.success && data.data.length > 0) {
        setStoreData(data.data[0]);
      }
    } catch (error) {
      console.error('Error fetching store data:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const data = await secureApiCall('/api/services');
      console.log('Services API response:', data); // Debug log
      
      if (data.success) {
        setService(data.data); // data.data will be the service object or null
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update stats with real data
  const statsCards = [
    {
      title: 'Total Services',
      value: (service?.services?.length || 0).toString(),
      icon: Wrench,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Active Services',
      value: (service?.services?.filter(s => s.isActive !== false)?.length || 0).toString(),
      icon: Wrench,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600'
    },
    {
      title: 'Average Service Price',
      value: service?.services?.length > 0 
        ? formatCurrency(service.services.reduce((sum, s) => sum + s.price, 0) / service.services.length)
        : formatCurrency(0),
      icon: Tag,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    }
  ];

  // Filter services based on search
  const filteredServices = service?.services?.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const formatDuration = (minutes, unit = 'minutes') => {
    if (unit === 'minutes' || minutes < 60) {
      return `${minutes} mins`;
    } else if (unit === 'hours' || minutes < 1440) {
      const hours = minutes / 60;
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else if (unit === 'days' || minutes < 10080) {
      const days = minutes / 1440;
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    } else {
      const weeks = minutes / 10080;
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Services Management" subtitle={getCurrentDate()}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading services...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Services Management" subtitle={getCurrentDate()}>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statsCards.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <div className={`p-2 ${stat.iconBg} rounded-xl mr-3`}>
                      <IconComponent className={`w-5 h-5 ${stat.iconColor}`} />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900">{stat.title}</h3>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Services Overview */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Services Overview</h2>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-80 bg-gray-50 border-0 rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm transition-all duration-200"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              <button 
                onClick={() => setIsAddServiceModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                <span>Add Service</span>
              </button>
            </div>
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="p-6">
            {!service || !service.services || filteredServices.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <Wrench className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">No services yet</p>
                <p className="text-gray-400 text-sm mb-4">Get started by adding your first service</p>
                <button 
                  onClick={() => setIsAddServiceModalOpen(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Your First Service</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredServices.map((serviceItem, index) => (
                  <div
                    key={serviceItem._id || index}
                    className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer"
                  >
                    {/* Service Image */}
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      {serviceItem.portfolioImages && serviceItem.portfolioImages.length > 0 ? (
                        <img
                          src={serviceItem.portfolioImages[0]}
                          alt={serviceItem.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Wrench className="w-16 h-16 text-gray-300" />
                        </div>
                      )}
                      
                      {/* Discount Badge */}
                      {serviceItem.discount > 0 && (
                        <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                          {serviceItem.discount}% OFF
                        </div>
                      )}

                      {/* Home Service Badge */}
                      {serviceItem.homeServiceAvailable && (
                        <div className="absolute top-3 left-3 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                          Home Service
                        </div>
                      )}
                    </div>

                    {/* Service Details */}
                    <div className="p-4">
                      {/* Category Badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-teal-50 text-teal-700">
                          {serviceItem.subCategory}
                        </span>
                        {serviceItem.yearsOfExperience > 0 && (
                          <span className="text-xs text-gray-500">
                            {serviceItem.yearsOfExperience}+ yrs
                          </span>
                        )}
                      </div>

                      {/* Service Name */}
                      <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-1 group-hover:text-teal-600 transition-colors">
                        {serviceItem.name}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {serviceItem.description}
                      </p>

                      {/* Info Row */}
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(serviceItem.duration, serviceItem.durationUnit)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>
                            {serviceItem.serviceLocations?.coverAllNigeria 
                              ? 'Nationwide' 
                              : `${serviceItem.serviceLocations?.states?.length || 0} states`
                            }
                          </span>
                        </div>
                      </div>

                      {/* Price and Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div>
                          <div className="text-lg font-bold text-gray-900">
                            {formatCurrency(serviceItem.price)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Max {serviceItem.maxBookingsPerDay}/day
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              // View details handler
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              // Edit handler
                            }}
                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                            title="Edit service"
                          >
                            <Edit className="w-4 h-4" />
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max/Day</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Home Service</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {!service || !service.services || filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Wrench className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg font-medium mb-2">No services yet</p>
                        <p className="text-gray-400 text-sm mb-4">Get started by adding your first service</p>
                        <button 
                          onClick={() => setIsAddServiceModalOpen(true)}
                          className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium transition-all duration-200"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Your First Service</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((serviceItem, index) => (
                    <tr 
                      key={serviceItem._id || index} 
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {/* Thumbnail */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            {serviceItem.portfolioImages && serviceItem.portfolioImages.length > 0 ? (
                              <img
                                src={serviceItem.portfolioImages[0]}
                                alt={serviceItem.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Wrench className="w-6 h-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{serviceItem.name}</div>
                            <div className="text-xs text-gray-500 truncate max-w-xs">{serviceItem.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{serviceItem.category}</div>
                        <div className="text-xs text-gray-500">{serviceItem.subCategory}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {formatDuration(serviceItem.duration, serviceItem.durationUnit)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(serviceItem.price)}
                        </div>
                        {serviceItem.discount > 0 && (
                          <div className="text-xs text-green-600">{serviceItem.discount}% off</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{serviceItem.maxBookingsPerDay || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                          serviceItem.homeServiceAvailable
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {serviceItem.homeServiceAvailable ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center space-x-1">
                          <button 
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                            title="Edit service"
                          >
                            <Edit className="w-4 h-4" />
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
        {service && service.services && filteredServices.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {filteredServices.length} services
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
          </div>
        )}
      </div>

      {/* Add Service Modal */}
      {isAddServiceModalOpen && (
        <AddServiceModal
          isOpen={isAddServiceModalOpen}
          onClose={() => setIsAddServiceModalOpen(false)}
          userData={userData}
          storeData={storeData}
          existingService={service}
        />
      )}
    </DashboardLayout>
  );
}
