"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function ElectronicsDetailsSection({
  electronicsDetails,
  handleCategoryDetailChange
}) {
  if (!electronicsDetails) return null;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Electronics Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Smartphones', label: 'Smartphones' },
              { value: 'Tablets', label: 'Tablets' },
              { value: 'Laptops', label: 'Laptops' },
              { value: 'Desktops', label: 'Desktops' },
              { value: 'Smartwatches', label: 'Smartwatches' },
              { value: 'Headphones', label: 'Headphones' },
              { value: 'Speakers', label: 'Speakers' },
              { value: 'Cameras', label: 'Cameras' },
              { value: 'Gaming Consoles', label: 'Gaming Consoles' },
              { value: 'TVs', label: 'TVs' },
              { value: 'Home Appliances', label: 'Home Appliances' },
              { value: 'Computer Accessories', label: 'Computer Accessories' },
              { value: 'Phone Accessories', label: 'Phone Accessories' },
              { value: 'Other', label: 'Other' }
            ]}
            value={electronicsDetails.productType}
            onChange={(value) => handleCategoryDetailChange('electronics', 'productType', value)}
            placeholder="Select product type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
          <CustomDropdown
            options={[
              { value: 'New', label: 'New' },
              { value: 'Refurbished', label: 'Refurbished' },
              { value: 'Used - Like New', label: 'Used - Like New' },
              { value: 'Used - Good', label: 'Used - Good' },
              { value: 'Used - Fair', label: 'Used - Fair' }
            ]}
            value={electronicsDetails.condition}
            onChange={(value) => handleCategoryDetailChange('electronics', 'condition', value)}
            placeholder="Select condition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
          <input
            type="text"
            value={electronicsDetails.model}
            onChange={(e) => handleCategoryDetailChange('electronics', 'model', e.target.value)}
            placeholder="e.g., iPhone 13 Pro, Galaxy S21"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Specifications</label>
          <textarea
            value={electronicsDetails.specifications || ''}
            onChange={(e) => handleCategoryDetailChange('electronics', 'specifications', e.target.value)}
            rows={3}
            placeholder="e.g., 8GB RAM, 256GB Storage, 6.1-inch display, A15 Bionic chip..."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-3">Warranty Information</label>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={electronicsDetails.warranty.hasWarranty}
                onChange={(e) => handleCategoryDetailChange('electronics', 'warranty', {
                  ...electronicsDetails.warranty,
                  hasWarranty: e.target.checked
                })}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Has Warranty</span>
            </label>

            {electronicsDetails.warranty.hasWarranty && (
              <div className="grid grid-cols-2 gap-3 pl-7">
                <input
                  type="text"
                  value={electronicsDetails.warranty.duration}
                  onChange={(e) => handleCategoryDetailChange('electronics', 'warranty', {
                    ...electronicsDetails.warranty,
                    duration: e.target.value
                  })}
                  placeholder="e.g., 1 year, 6 months"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                />
                <input
                  type="text"
                  value={electronicsDetails.warranty.type}
                  onChange={(e) => handleCategoryDetailChange('electronics', 'warranty', {
                    ...electronicsDetails.warranty,
                    type: e.target.value
                  })}
                  placeholder="e.g., Manufacturer, Store"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                />
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Connectivity (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['WiFi', 'Bluetooth', '4G', '5G', 'USB-C', 'HDMI', 'Ethernet', 'Other'].map(connectivity => (
              <button
                key={connectivity}
                type="button"
                onClick={() => {
                  const currentConnectivity = electronicsDetails.connectivity || [];
                  if (currentConnectivity.includes(connectivity)) {
                    handleCategoryDetailChange('electronics', 'connectivity', 
                      currentConnectivity.filter(c => c !== connectivity)
                    );
                  } else {
                    handleCategoryDetailChange('electronics', 'connectivity', 
                      [...currentConnectivity, connectivity]
                    );
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (electronicsDetails.connectivity || []).includes(connectivity)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {connectivity}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
