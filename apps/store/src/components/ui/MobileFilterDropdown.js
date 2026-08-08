'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';

export default function MobileFilterDropdown({
  categoryOptions = [],
  priceOptions = [],
  availabilityOptions = [],
  selectedCategory,
  selectedPrice,
  selectedAvailability,
  onCategorySelect,
  onPriceSelect,
  onAvailabilitySelect,
  // Add modal trigger functions
  onCategoryModalOpen,
  onPriceModalOpen,
  onAvailabilityModalOpen,
  primaryColor = '#0D9488',
  secondaryColor = '#F3F4F6'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedCategory && selectedCategory !== 'all') count++;
    if (selectedPrice && selectedPrice !== 'all') count++;
    if (selectedAvailability && selectedAvailability !== 'all') count++;
    return count;
  };

  const clearAllFilters = () => {
    onCategorySelect('all');
    onPriceSelect('all');
    onAvailabilitySelect('all');
    setIsOpen(false);
  };

  // Get current filter labels
  const getCategoryLabel = () => {
    const option = categoryOptions.find(c => c.value === selectedCategory);
    return option?.label || "All Categories";
  };

  const getPriceLabel = () => {
    const option = priceOptions.find(p => p.value === selectedPrice);
    return option?.label || "All Prices";
  };

  const getAvailabilityLabel = () => {
    const option = availabilityOptions.find(a => a.value === selectedAvailability);
    return option?.label || "All Products";
  };

  const handleFilterModalOpen = (type) => {
    setIsOpen(false); // Close dropdown first
    switch (type) {
      case 'category':
        onCategoryModalOpen();
        break;
      case 'price':
        onPriceModalOpen();
        break;
      case 'availability':
        onAvailabilityModalOpen();
        break;
    }
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="relative sm:hidden z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:opacity-90 transition-colors w-full justify-between"
        style={{ backgroundColor: 'white' }}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span 
              className="px-2 py-0.5 text-xs text-white rounded-full font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              {activeFiltersCount}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-[100] max-h-96 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Filter Products</h3>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Filter Options - Now trigger modals */}
          <div className="p-4 space-y-3">
            {/* Category Filter */}
            <button
              onClick={() => handleFilterModalOpen('category')}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
            >
              <div>
                <p className="font-medium text-gray-900">Category</p>
                <p className="text-sm text-gray-500">{getCategoryLabel()}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {/* Price Filter */}
            <button
              onClick={() => handleFilterModalOpen('price')}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
            >
              <div>
                <p className="font-medium text-gray-900">Price Range</p>
                <p className="text-sm text-gray-500">{getPriceLabel()}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {/* Availability Filter */}
            <button
              onClick={() => handleFilterModalOpen('availability')}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
            >
              <div>
                <p className="font-medium text-gray-900">Availability</p>
                <p className="text-sm text-gray-500">{getAvailabilityLabel()}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
