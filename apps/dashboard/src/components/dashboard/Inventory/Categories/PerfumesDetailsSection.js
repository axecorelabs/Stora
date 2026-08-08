"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function PerfumesDetailsSection({
  perfumeDetails,
  handleCategoryDetailChange
}) {
  if (!perfumeDetails) return null;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Perfume Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type of fragrance
          </label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Eau de Parfum', label: 'Eau de Parfum' },
              { value: 'Eau de Toilette', label: 'Eau de Toilette' },
              { value: 'Cologne', label: 'Cologne' },
              { value: 'Body Spray', label: 'Body Spray' },
              { value: 'Perfume Oil', label: 'Perfume Oil' },
              { value: 'Body Mist', label: 'Body Mist' },
              { value: 'Other', label: 'Other' }
            ]}
            value={perfumeDetails.fragranceType}
            onChange={(value) => handleCategoryDetailChange('perfume', 'fragranceType', value)}
            placeholder="Select fragrance type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            For who?
          </label>
          <CustomDropdown
            options={[
              { value: 'Men', label: 'Men' },
              { value: 'Women', label: 'Women' },
              { value: 'Unisex', label: 'Unisex' }
            ]}
            value={perfumeDetails.gender}
            onChange={(value) => handleCategoryDetailChange('perfume', 'gender', value)}
            placeholder="Select gender"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Volume
          </label>
          <input
            type="text"
            value={perfumeDetails.volume}
            onChange={(e) => handleCategoryDetailChange('perfume', 'volume', e.target.value)}
            placeholder="e.g., 50ml, 100ml"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scent family
          </label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select scent' },
              { value: 'Floral', label: 'Floral' },
              { value: 'Woody', label: 'Woody' },
              { value: 'Fresh/Citrus', label: 'Fresh/Citrus' },
              { value: 'Oriental/Spicy', label: 'Oriental/Spicy' },
              { value: 'Fruity', label: 'Fruity' },
              { value: 'Aquatic', label: 'Aquatic' },
              { value: 'Other', label: 'Other' }
            ]}
            value={perfumeDetails.scentFamily}
            onChange={(value) => handleCategoryDetailChange('perfume', 'scentFamily', value)}
            placeholder="Select scent family"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Strength
          </label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select strength' },
              { value: 'Light', label: 'Light' },
              { value: 'Moderate', label: 'Moderate' },
              { value: 'Strong', label: 'Strong' },
              { value: 'Very Strong', label: 'Very Strong' }
            ]}
            value={perfumeDetails.concentration}
            onChange={(value) => handleCategoryDetailChange('perfume', 'concentration', value)}
            placeholder="Select strength"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Occasions (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['Everyday', 'Office', 'Evening/Night', 'Special Occasion', 'Sports', 'Owambe', 'Wedding', 'Church/Religious', 'Date Night', 'Other'].map(occasion => (
              <button
                key={occasion}
                type="button"
                onClick={() => {
                  const occasions = perfumeDetails.occasion || [];
                  if (occasions.includes(occasion)) {
                    handleCategoryDetailChange('perfume', 'occasion', occasions.filter(o => o !== occasion));
                  } else {
                    handleCategoryDetailChange('perfume', 'occasion', [...occasions, occasion]);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (perfumeDetails.occasion || []).includes(occasion)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {occasion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
