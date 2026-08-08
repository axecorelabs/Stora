"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function BeveragesDetailsSection({
  beveragesDetails,
  handleCategoryDetailChange
}) {
  if (!beveragesDetails) return null;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Beverage Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Beverage Type</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Soft Drinks', label: 'Soft Drinks' },
              { value: 'Juices', label: 'Juices' },
              { value: 'Energy Drinks', label: 'Energy Drinks' },
              { value: 'Water', label: 'Water' },
              { value: 'Tea/Coffee', label: 'Tea/Coffee' },
              { value: 'Smoothies', label: 'Smoothies' },
              { value: 'Alcoholic Beverages', label: 'Alcoholic Beverages' },
              { value: 'Traditional Drinks', label: 'Traditional Drinks' },
              { value: 'Other', label: 'Other' }
            ]}
            value={beveragesDetails.beverageType}
            onChange={(value) => handleCategoryDetailChange('beverages', 'beverageType', value)}
            placeholder="Select beverage type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Volume/Size</label>
          <input
            type="text"
            value={beveragesDetails.volume}
            onChange={(e) => handleCategoryDetailChange('beverages', 'volume', e.target.value)}
            placeholder="e.g., 50cl, 1L, 2L"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Packaging</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select packaging' },
              { value: 'Bottle', label: 'Bottle' },
              { value: 'Can', label: 'Can' },
              { value: 'Sachet', label: 'Sachet' },
              { value: 'Carton', label: 'Carton' },
              { value: 'Cup', label: 'Cup' },
              { value: 'Keg', label: 'Keg' },
              { value: 'Other', label: 'Other' }
            ]}
            value={beveragesDetails.packaging}
            onChange={(value) => handleCategoryDetailChange('beverages', 'packaging', value)}
            placeholder="Select packaging"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Alcoholic Content (if applicable)</label>
          <input
            type="text"
            value={beveragesDetails.alcoholContent}
            onChange={(e) => handleCategoryDetailChange('beverages', 'alcoholContent', e.target.value)}
            placeholder="e.g., 5%, 12%"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Flavor Profile (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['Sweet', 'Sour', 'Bitter', 'Fruity', 'Citrus', 'Herbal', 'Spicy', 'Other'].map(flavor => (
              <button
                key={flavor}
                type="button"
                onClick={() => {
                  const flavors = beveragesDetails.flavorProfile || [];
                  if (flavors.includes(flavor)) {
                    handleCategoryDetailChange('beverages', 'flavorProfile', flavors.filter(f => f !== flavor));
                  } else {
                    handleCategoryDetailChange('beverages', 'flavorProfile', [...flavors, flavor]);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (beveragesDetails.flavorProfile || []).includes(flavor)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {flavor}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
