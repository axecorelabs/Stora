"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function AutomotiveDetailsSection({
  automotiveDetails,
  handleCategoryDetailChange
}) {
  if (!automotiveDetails) return null;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Automotive Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Spare Parts', label: 'Spare Parts' },
              { value: 'Tires', label: 'Tires' },
              { value: 'Batteries', label: 'Batteries' },
              { value: 'Engine Parts', label: 'Engine Parts' },
              { value: 'Body Parts', label: 'Body Parts' },
              { value: 'Interior Accessories', label: 'Interior Accessories' },
              { value: 'Exterior Accessories', label: 'Exterior Accessories' },
              { value: 'Electronics', label: 'Electronics' },
              { value: 'Tools', label: 'Tools' },
              { value: 'Oils & Fluids', label: 'Oils & Fluids' },
              { value: 'Car Care', label: 'Car Care' },
              { value: 'Other', label: 'Other' }
            ]}
            value={automotiveDetails.productType}
            onChange={(value) => handleCategoryDetailChange('automotive', 'productType', value)}
            placeholder="Select product type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Part Number</label>
          <input
            type="text"
            value={automotiveDetails.partNumber}
            onChange={(e) => handleCategoryDetailChange('automotive', 'partNumber', e.target.value)}
            placeholder="Part number"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
          <CustomDropdown
            options={[
              { value: 'New', label: 'New' },
              { value: 'OEM', label: 'OEM' },
              { value: 'Aftermarket', label: 'Aftermarket' },
              { value: 'Refurbished', label: 'Refurbished' },
              { value: 'Used', label: 'Used' }
            ]}
            value={automotiveDetails.condition}
            onChange={(value) => handleCategoryDetailChange('automotive', 'condition', value)}
            placeholder="Select condition"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-3">Warranty Information</label>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={automotiveDetails.warranty.hasWarranty}
                onChange={(e) => handleCategoryDetailChange('automotive', 'warranty', {
                  ...automotiveDetails.warranty,
                  hasWarranty: e.target.checked
                })}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Has Warranty</span>
            </label>

            {automotiveDetails.warranty.hasWarranty && (
              <input
                type="text"
                value={automotiveDetails.warranty.duration}
                onChange={(e) => handleCategoryDetailChange('automotive', 'warranty', {
                  ...automotiveDetails.warranty,
                  duration: e.target.value
                })}
                placeholder="e.g., 6 months, 1 year"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ml-7"
              />
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Specifications</label>
          <textarea
            value={automotiveDetails.specifications}
            onChange={(e) => handleCategoryDetailChange('automotive', 'specifications', e.target.value)}
            rows={3}
            placeholder="Enter technical specifications..."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>
      </div>
    </div>
  );
}
