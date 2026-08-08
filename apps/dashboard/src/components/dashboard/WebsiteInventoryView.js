"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ArrowLeft,
  Package,
  Eye,
  EyeOff,
  Search,
  Filter,
  Globe,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings
} from "lucide-react";
import CustomDropdown from "../ui/CustomDropdown";

export default function WebsiteInventoryView({ onBack, store }) {
  const { secureApiCall } = useAuth();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [togglingItems, setTogglingItems] = useState(new Set());

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Products' },
    { value: 'visibility', label: 'Filter by Visibility' },
    { value: 'category', label: 'Filter by Category' },
    { value: 'status', label: 'Filter by Status' }
  ];

  // Visibility filter options
  const visibilityOptions = [
    { value: '', label: 'All Visibility States' },
    { value: 'visible', label: 'Visible on Website' },
    { value: 'hidden', label: 'Hidden from Website' }
  ];

  // Status filter options
  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
    { value: 'Discontinued', label: 'Discontinued' }
  ];

  // Fetch inventory items
  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      const response = await secureApiCall('/api/inventory');
      if (response.success) {
        // Ensure webVisibility is always defined
        const itemsWithVisibility = response.data.map(item => ({
          ...item,
          webVisibility: item.webVisibility !== undefined ? item.webVisibility : true
        }));
        setInventoryItems(itemsWithVisibility);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  // Toggle web visibility
  const toggleWebVisibility = async (itemId, currentVisibility) => {
    setTogglingItems(prev => new Set([...prev, itemId]));
    
    try {
      const response = await secureApiCall(`/api/inventory/${itemId}/web-visibility`, {
        method: 'PUT',
        body: JSON.stringify({ webVisibility: !currentVisibility })
      });

      if (response.success) {
        // Update local state with explicit boolean value
        setInventoryItems(prev => 
          prev.map(item => 
            item._id === itemId 
              ? { ...item, webVisibility: Boolean(!currentVisibility) }
              : item
          )
        );
      } else {
        console.error('Failed to toggle visibility:', response.message);
        alert('Failed to update visibility. Please try again.');
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Error updating visibility. Please try again.');
    } finally {
      setTogglingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  // Get unique categories
  const getUniqueCategories = () => {
    const categories = [...new Set(inventoryItems.map(item => item.category))];
    return [
      { value: '', label: 'All Categories' },
      ...categories.map(cat => ({ value: cat, label: cat }))
    ];
  };

  // Filter items based on search and filters
  const getFilteredItems = () => {
    let filtered = inventoryItems;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply selected filter
    if (filterBy !== 'all' && filterValue) {
      switch (filterBy) {
        case 'visibility':
          filtered = filtered.filter(item => {
            if (filterValue === 'visible') return Boolean(item.webVisibility);
            if (filterValue === 'hidden') return !Boolean(item.webVisibility);
            return true;
          });
          break;
        case 'category':
          filtered = filtered.filter(item => item.category === filterValue);
          break;
        case 'status':
          filtered = filtered.filter(item => item.status === filterValue);
          break;
      }
    }

    return filtered;
  };

  // Handle filter changes
  const handleFilterByChange = (value) => {
    setFilterBy(value);
    setFilterValue('');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Get visibility stats
  const getVisibilityStats = () => {
    const total = inventoryItems.length;
    const visible = inventoryItems.filter(item => Boolean(item.webVisibility)).length;
    const hidden = total - visible;
    return { total, visible, hidden };
  };

  const visibilityStats = getVisibilityStats();
  const filteredItems = getFilteredItems();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading website inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Website</span>
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Website Inventory</h1>
            <p className="text-gray-500">Manage which products appear on your website</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {store?.websiteUrl && (
            <a
              href={store.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>View Website</span>
            </a>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Total Products</h3>
            <Package className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{visibilityStats.total}</p>
          <p className="text-xs text-gray-500 mt-1">In your inventory</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Visible on Website</h3>
            <Eye className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{visibilityStats.visible}</p>
          <p className="text-xs text-gray-500 mt-1">
            {visibilityStats.total > 0 
              ? `${Math.round((visibilityStats.visible / visibilityStats.total) * 100)}% of total`
              : '0% of total'
            }
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Hidden from Website</h3>
            <EyeOff className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">{visibilityStats.hidden}</p>
          <p className="text-xs text-gray-500 mt-1">
            {visibilityStats.total > 0 
              ? `${Math.round((visibilityStats.hidden / visibilityStats.total) * 100)}% of total`
              : '0% of total'
            }
          </p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Product Visibility Management</h2>
            <div className="flex items-center space-x-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-80 bg-gray-50 border-0 rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm transition-all duration-200"
                />
              </div>

              {/* Filter Type Dropdown */}
              <CustomDropdown
                options={filterOptions}
                value={filterBy}
                onChange={handleFilterByChange}
                placeholder="Filter by..."
                className="w-48"
              />

              {/* Filter Value Dropdown */}
              {filterBy !== 'all' && (
                <CustomDropdown
                  options={
                    filterBy === 'visibility' ? visibilityOptions :
                    filterBy === 'category' ? getUniqueCategories() :
                    filterBy === 'status' ? statusOptions : []
                  }
                  value={filterValue}
                  onChange={setFilterValue}
                  placeholder={
                    filterBy === 'visibility' ? 'Select visibility' :
                    filterBy === 'category' ? 'Select category' :
                    filterBy === 'status' ? 'Select status' : 'Select value'
                  }
                  className="w-48"
                />
              )}

              {/* Clear filters */}
              {(filterBy !== 'all' || searchTerm) && (
                <button 
                  onClick={() => {
                    setFilterBy('all');
                    setFilterValue('');
                    setSearchTerm('');
                  }}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website Visibility</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      {inventoryItems.length === 0 ? (
                        <>
                          <Package className="w-12 h-12 text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg font-medium mb-2">No products found</p>
                          <p className="text-gray-400 text-sm">Add products to your inventory to manage website visibility</p>
                        </>
                      ) : (
                        <>
                          <Filter className="w-12 h-12 text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg font-medium mb-2">No products match your filters</p>
                          <p className="text-gray-400 text-sm">Try adjusting your search or filter criteria</p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.productName}
                            className="w-10 h-10 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                          {item.brand && (
                            <div className="text-xs text-gray-500">{item.brand}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-gray-700">{item.sku}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{item.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {item.quantityInStock} {item.unitOfMeasure}
                      </div>
                      {item.quantityInStock <= item.reorderLevel && (
                        <div className="text-xs text-yellow-600 flex items-center mt-1">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Low stock
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{formatCurrency(item.sellingPrice)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                        item.status === 'Active' ? 'bg-green-100 text-green-800' :
                        item.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {Boolean(item.webVisibility) ? (
                          <div className="flex items-center space-x-2 text-green-600">
                            <Eye className="w-4 h-4" />
                            <span className="text-sm font-medium">Visible</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 text-red-600">
                            <EyeOff className="w-4 h-4" />
                            <span className="text-sm font-medium">Hidden</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(item.webVisibility)}
                            onChange={() => toggleWebVisibility(item._id, Boolean(item.webVisibility))}
                            disabled={togglingItems.has(item._id)}
                            className="sr-only peer"
                          />
                          <div className={`w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 transition-all ${
                            Boolean(item.webVisibility)
                              ? 'bg-teal-600 peer-checked:after:translate-x-full' 
                              : 'bg-gray-200'
                          } peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                            togglingItems.has(item._id) ? 'opacity-50 cursor-not-allowed' : ''
                          }`}></div>
                        </label>
                        {togglingItems.has(item._id) && (
                          <div className="w-4 h-4">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Results Summary */}
        {inventoryItems.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {filteredItems.length} of {inventoryItems.length} products
              {searchTerm && ` matching "${searchTerm}"`}
              {filterBy !== 'all' && filterValue && ` with applied filters`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
