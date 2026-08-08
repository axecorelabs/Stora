"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function HomeGardenDetailsSection({
  homeGardenDetails,
  handleCategoryDetailChange
}) {
  if (!homeGardenDetails) return null;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Home & Garden Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Furniture', label: 'Furniture' },
              { value: 'Decor', label: 'Decor' },
              { value: 'Kitchen & Dining', label: 'Kitchen & Dining' },
              { value: 'Bedding', label: 'Bedding' },
              { value: 'Bathroom', label: 'Bathroom' },
              { value: 'Lighting', label: 'Lighting' },
              { value: 'Storage', label: 'Storage' },
              { value: 'Garden Tools', label: 'Garden Tools' },
              { value: 'Plants', label: 'Plants' },
              { value: 'Outdoor Furniture', label: 'Outdoor Furniture' },
              { value: 'Home Improvement', label: 'Home Improvement' },
              { value: 'Cleaning Supplies', label: 'Cleaning Supplies' },
              { value: 'Other', label: 'Other' }
            ]}
            value={homeGardenDetails.productType}
            onChange={(value) => handleCategoryDetailChange('homeGarden', 'productType', value)}
            placeholder="Select product type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Material</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select material' },
              { value: 'Wood', label: 'Wood' },
              { value: 'Metal', label: 'Metal' },
              { value: 'Plastic', label: 'Plastic' },
              { value: 'Glass', label: 'Glass' },
              { value: 'Fabric', label: 'Fabric' },
              { value: 'Ceramic', label: 'Ceramic' },
              { value: 'Stone', label: 'Stone' },
              { value: 'Mixed', label: 'Mixed' },
              { value: 'Other', label: 'Other' }
            ]}
            value={homeGardenDetails.material}
            onChange={(value) => handleCategoryDetailChange('homeGarden', 'material', value)}
            placeholder="Select material"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Room (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room', 'Office', 'Garden', 'Outdoor', 'All Rooms'].map(room => (
              <button
                key={room}
                type="button"
                onClick={() => {
                  const rooms = homeGardenDetails.room || [];
                  if (rooms.includes(room)) {
                    handleCategoryDetailChange('homeGarden', 'room', rooms.filter(r => r !== room));
                  } else {
                    handleCategoryDetailChange('homeGarden', 'room', [...rooms, room]);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (homeGardenDetails.room || []).includes(room)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {room}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Dimensions (Optional)
          </label>
          <div className="grid grid-cols-4 gap-3">
            <input
              type="text"
              value={homeGardenDetails.dimensions.length}
              onChange={(e) => handleCategoryDetailChange('homeGarden', 'dimensions', {
                ...homeGardenDetails.dimensions,
                length: e.target.value
              })}
              placeholder="Length"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
            />
            <input
              type="text"
              value={homeGardenDetails.dimensions.width}
              onChange={(e) => handleCategoryDetailChange('homeGarden', 'dimensions', {
                ...homeGardenDetails.dimensions,
                width: e.target.value
              })}
              placeholder="Width"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
            />
            <input
              type="text"
              value={homeGardenDetails.dimensions.height}
              onChange={(e) => handleCategoryDetailChange('homeGarden', 'dimensions', {
                ...homeGardenDetails.dimensions,
                height: e.target.value
              })}
              placeholder="Height"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
            />
            <input
              type="text"
              value={homeGardenDetails.dimensions.weight}
              onChange={(e) => handleCategoryDetailChange('homeGarden', 'dimensions', {
                ...homeGardenDetails.dimensions,
                weight: e.target.value
              })}
              placeholder="Weight"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={homeGardenDetails.assemblyRequired}
              onChange={(e) => handleCategoryDetailChange('homeGarden', 'assemblyRequired', e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">Assembly Required</span>
          </label>
        </div>
      </div>
    </div>
  );
}
