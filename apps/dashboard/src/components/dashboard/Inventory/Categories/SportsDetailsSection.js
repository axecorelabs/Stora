"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function SportsDetailsSection({
  sportsDetails,
  handleCategoryDetailChange
}) {
  if (!sportsDetails) return null;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Sports Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sport Type</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select sport' },
              { value: 'Football/Soccer', label: 'Football/Soccer' },
              { value: 'Basketball', label: 'Basketball' },
              { value: 'Tennis', label: 'Tennis' },
              { value: 'Fitness & Gym', label: 'Fitness & Gym' },
              { value: 'Running', label: 'Running' },
              { value: 'Swimming', label: 'Swimming' },
              { value: 'Cycling', label: 'Cycling' },
              { value: 'Boxing', label: 'Boxing' },
              { value: 'Yoga', label: 'Yoga' },
              { value: 'Outdoor Sports', label: 'Outdoor Sports' },
              { value: 'Team Sports', label: 'Team Sports' },
              { value: 'Water Sports', label: 'Water Sports' },
              { value: 'Other', label: 'Other' }
            ]}
            value={sportsDetails.sportType}
            onChange={(value) => handleCategoryDetailChange('sports', 'sportType', value)}
            placeholder="Select sport type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Equipment', label: 'Equipment' },
              { value: 'Apparel', label: 'Apparel' },
              { value: 'Footwear', label: 'Footwear' },
              { value: 'Accessories', label: 'Accessories' },
              { value: 'Protective Gear', label: 'Protective Gear' },
              { value: 'Training Aids', label: 'Training Aids' },
              { value: 'Nutrition', label: 'Nutrition' },
              { value: 'Other', label: 'Other' }
            ]}
            value={sportsDetails.productType}
            onChange={(value) => handleCategoryDetailChange('sports', 'productType', value)}
            placeholder="Select product type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Performance Level</label>
          <CustomDropdown
            options={[
              { value: 'All Levels', label: 'All Levels' },
              { value: 'Beginner', label: 'Beginner' },
              { value: 'Intermediate', label: 'Intermediate' },
              { value: 'Advanced', label: 'Advanced' },
              { value: 'Professional', label: 'Professional' }
            ]}
            value={sportsDetails.performanceLevel}
            onChange={(value) => handleCategoryDetailChange('sports', 'performanceLevel', value)}
            placeholder="Select level"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Suitable For (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['Men', 'Women', 'Unisex', 'Kids', 'Professional', 'Amateur'].map(suitable => (
              <button
                key={suitable}
                type="button"
                onClick={() => {
                  const suitableFor = sportsDetails.suitableFor || [];
                  if (suitableFor.includes(suitable)) {
                    handleCategoryDetailChange('sports', 'suitableFor', 
                      suitableFor.filter(s => s !== suitable)
                    );
                  } else {
                    handleCategoryDetailChange('sports', 'suitableFor', 
                      [...suitableFor, suitable]
                    );
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (sportsDetails.suitableFor || []).includes(suitable)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {suitable}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
