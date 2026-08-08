"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function HealthBeautyDetailsSection({
  healthBeautyDetails,
  handleCategoryDetailChange
}) {
  if (!healthBeautyDetails) return null;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Health & Beauty Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Skincare', label: 'Skincare' },
              { value: 'Haircare', label: 'Haircare' },
              { value: 'Makeup', label: 'Makeup' },
              { value: 'Fragrance', label: 'Fragrance' },
              { value: 'Personal Care', label: 'Personal Care' },
              { value: 'Health Supplements', label: 'Health Supplements' },
              { value: 'Medical Supplies', label: 'Medical Supplies' },
              { value: 'Fitness & Nutrition', label: 'Fitness & Nutrition' },
              { value: 'Bath & Body', label: 'Bath & Body' },
              { value: 'Oral Care', label: 'Oral Care' },
              { value: "Men's Grooming", label: "Men's Grooming" },
              { value: 'Other', label: 'Other' }
            ]}
            value={healthBeautyDetails.productType}
            onChange={(value) => handleCategoryDetailChange('healthBeauty', 'productType', value)}
            placeholder="Select product type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Volume/Size</label>
          <input
            type="text"
            value={healthBeautyDetails.volume}
            onChange={(e) => handleCategoryDetailChange('healthBeauty', 'volume', e.target.value)}
            placeholder="e.g., 50ml, 100g"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Scent (if applicable)</label>
          <input
            type="text"
            value={healthBeautyDetails.scent}
            onChange={(e) => handleCategoryDetailChange('healthBeauty', 'scent', e.target.value)}
            placeholder="e.g., Lavender, Rose"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Skin Type (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['Normal', 'Oily', 'Dry', 'Combination', 'Sensitive', 'All Skin Types'].map(skinType => (
              <button
                key={skinType}
                type="button"
                onClick={() => {
                  const skinTypes = healthBeautyDetails.skinType || [];
                  if (skinTypes.includes(skinType)) {
                    handleCategoryDetailChange('healthBeauty', 'skinType', skinTypes.filter(s => s !== skinType));
                  } else {
                    handleCategoryDetailChange('healthBeauty', 'skinType', [...skinTypes, skinType]);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (healthBeautyDetails.skinType || []).includes(skinType)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {skinType}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Suitable For (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['Men', 'Women', 'Unisex', 'Kids', 'All Ages'].map(suitable => (
              <button
                key={suitable}
                type="button"
                onClick={() => {
                  const suitableFor = healthBeautyDetails.suitableFor || [];
                  if (suitableFor.includes(suitable)) {
                    handleCategoryDetailChange('healthBeauty', 'suitableFor', 
                      suitableFor.filter(s => s !== suitable)
                    );
                  } else {
                    handleCategoryDetailChange('healthBeauty', 'suitableFor', 
                      [...suitableFor, suitable]
                    );
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (healthBeautyDetails.suitableFor || []).includes(suitable)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {suitable}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Application Area (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['Face', 'Body', 'Hair', 'Hands', 'Feet', 'Nails', 'Eyes', 'Lips', 'Full Body'].map(area => (
              <button
                key={area}
                type="button"
                onClick={() => {
                  const areas = healthBeautyDetails.applicationArea || [];
                  if (areas.includes(area)) {
                    handleCategoryDetailChange('healthBeauty', 'applicationArea', 
                      areas.filter(a => a !== area)
                    );
                  } else {
                    handleCategoryDetailChange('healthBeauty', 'applicationArea', 
                      [...areas, area]
                    );
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (healthBeautyDetails.applicationArea || []).includes(area)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={healthBeautyDetails.isOrganic}
              onChange={(e) => handleCategoryDetailChange('healthBeauty', 'isOrganic', e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">Organic/Natural Product</span>
          </label>
        </div>
      </div>
    </div>
  );
}
