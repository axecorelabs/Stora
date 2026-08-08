"use client";
import { useState, useEffect } from "react";
import { X, Activity, Clock, User, Package, TrendingUp, TrendingDown, Edit, Image, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CustomDropdown from "../ui/CustomDropdown";

export default function InventoryActivityPanel({ isOpen, onClose, item }) {
  const { secureApiCall } = useAuth();
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const filterOptions = [
    { value: 'all', label: 'All Activities' },
    { value: 'stock_added', label: 'Stock Added' },
    { value: 'stock_removed', label: 'Stock Removed' },
    { value: 'updated', label: 'Updates' },
    { value: 'price_updated', label: 'Price Changes' }
  ];

  const fetchActivities = async () => {
    if (!item?._id) return;
    
    setLoading(true);
    try {
      const url = filter === 'all' 
        ? `/api/inventory/${item._id}/activities`
        : `/api/inventory/${item._id}/activities?activityType=${filter}`;
        
      const response = await secureApiCall(url);
      if (response.success) {
        setActivities(response.data.activities);
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && item) {
      fetchActivities();
    }
  }, [isOpen, item, filter]);

  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'created': return <Package className="w-4 h-4 text-green-600" />;
      case 'updated': return <Edit className="w-4 h-4 text-blue-600" />;
      case 'stock_added': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'stock_removed': return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'price_updated': return <TrendingUp className="w-4 h-4 text-purple-600" />;
      case 'image_updated': return <Image className="w-4 h-4 text-blue-600" />;
      case 'deleted': return <Trash2 className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityColor = (activityType) => {
    switch (activityType) {
      case 'created': return 'bg-green-100 border-green-200';
      case 'updated': return 'bg-blue-100 border-blue-200';
      case 'stock_added': return 'bg-green-100 border-green-200';
      case 'stock_removed': return 'bg-red-100 border-red-200';
      case 'price_updated': return 'bg-purple-100 border-purple-200';
      case 'image_updated': return 'bg-blue-100 border-blue-200';
      case 'deleted': return 'bg-red-100 border-red-200';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  const formatActivityTime = (date) => {
    const now = new Date();
    const activityDate = new Date(date);
    const diffMs = now - activityDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return activityDate.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      
      {/* Sliding Panel */}
      <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Activity History</h3>
                <p className="text-sm text-gray-500">{item?.productName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Stats Overview */}
          {stats.length > 0 && (
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Activity Summary</h4>
              <div className="grid grid-cols-2 gap-3">
                {stats.slice(0, 4).map((stat) => (
                  <div key={stat._id} className="bg-white rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      {getActivityIcon(stat._id)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{stat.count}</p>
                        <p className="text-xs text-gray-500 capitalize">{stat._id.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="p-6 border-b border-gray-200">
            <CustomDropdown
              options={filterOptions}
              value={filter}
              onChange={(value) => setFilter(value)}
              placeholder="Filter activities"
              className="w-full"
            />
          </div>

          {/* Activity List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : activities.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No activities found</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity._id}
                    className={`border rounded-xl p-4 ${getActivityColor(activity.activityType)}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getActivityIcon(activity.activityType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </p>
                        
                        {/* Stock Movement Details */}
                        {activity.stockMovement && (
                          <div className="mt-2 p-2 bg-white/50 rounded-lg">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Previous:</span>
                              <span className="font-medium">{activity.stockMovement.previousStock}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">New:</span>
                              <span className="font-medium">{activity.stockMovement.newStock}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Change:</span>
                              <span className={`font-medium ${
                                activity.stockMovement.type === 'add' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {activity.stockMovement.type === 'add' ? '+' : '-'}{activity.stockMovement.quantity}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Changes Details */}
                        {activity.changes && Object.keys(activity.changes).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(activity.changes).map(([key, change]) => (
                              <div key={key} className="text-xs text-gray-600">
                                {key}: {typeof change === 'object' ? `${change.from} → ${change.to}` : change}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>{formatActivityTime(activity.createdAt)}</span>
                          </div>
                          {activity.userId && (
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <User className="w-3 h-3" />
                              <span>{activity.userId.firstName} {activity.userId.lastName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
