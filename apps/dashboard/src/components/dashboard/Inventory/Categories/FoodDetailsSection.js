"use client";
import { useState } from "react";
import { X } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function FoodDetailsSection({
  foodDetails,
  handleCategoryDetailChange
}) {
  const [newExtra, setNewExtra] = useState('');

  if (!foodDetails) return null;

  const extras = foodDetails.extras || [];

  const addExtra = () => {
    const value = newExtra.trim();
    if (!value || extras.includes(value)) return;
    handleCategoryDetailChange('food', 'extras', [...extras, value]);
    setNewExtra('');
  };

  const removeExtra = (extra) => {
    handleCategoryDetailChange('food', 'extras', extras.filter(e => e !== extra));
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Food Details
      </h3>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> If you also provide chef services or accept custom orders, 
          you can create a service in the <strong>Services</strong> tab!
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Food Type</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Ready-to-Eat Meals', label: 'Ready-to-Eat Meals' },
              { value: 'Meal Prep/Packaged Food', label: 'Meal Prep/Packaged Food' },
              { value: 'Baked Goods', label: 'Baked Goods' },
              { value: 'Snacks & Small Chops', label: 'Snacks & Small Chops' },
              { value: 'Traditional Nigerian Dishes', label: 'Traditional Nigerian Dishes' },
              { value: 'Continental Dishes', label: 'Continental Dishes' },
              { value: 'Fast Food', label: 'Fast Food' },
              { value: 'Healthy/Organic Meals', label: 'Healthy/Organic Meals' },
              { value: 'Frozen Foods', label: 'Frozen Foods' },
              { value: 'Other', label: 'Other' }
            ]}
            value={foodDetails.foodType}
            onChange={(value) => handleCategoryDetailChange('food', 'foodType', value)}
            placeholder="Select food type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Serving Size</label>
          <input
            type="text"
            value={foodDetails.servingSize}
            onChange={(e) => handleCategoryDetailChange('food', 'servingSize', e.target.value)}
            placeholder="e.g., 1 person, 2-3 people, Family pack"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Max Orders Per Day</label>
          <input
            type="number"
            value={foodDetails.maxOrdersPerDay}
            onChange={(e) => handleCategoryDetailChange('food', 'maxOrdersPerDay', e.target.value)}
            placeholder="e.g., 50"
            min="1"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Spice Level</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select spice level' },
              { value: 'Not Spicy', label: 'Not Spicy' },
              { value: 'Mild', label: 'Mild' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Hot', label: 'Hot' },
              { value: 'Extra Hot', label: 'Extra Hot' }
            ]}
            value={foodDetails.spiceLevel}
            onChange={(value) => handleCategoryDetailChange('food', 'spiceLevel', value)}
            placeholder="Select spice level"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Allergens (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['None', 'Nuts', 'Dairy', 'Eggs', 'Gluten', 'Soy', 'Shellfish', 'Fish'].map(allergen => (
              <button
                key={allergen}
                type="button"
                onClick={() => {
                  const allergens = foodDetails.allergens || [];
                  if (allergens.includes(allergen)) {
                    handleCategoryDetailChange('food', 'allergens', allergens.filter(a => a !== allergen));
                  } else {
                    handleCategoryDetailChange('food', 'allergens', [...allergens, allergen]);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (foodDetails.allergens || []).includes(allergen)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {allergen}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Extras (optional add-ons buyers can pick, e.g. Extra cheese, No onions)
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newExtra}
              onChange={(e) => setNewExtra(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExtra();
                }
              }}
              placeholder="e.g. Extra cheese"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
            />
            <button
              type="button"
              onClick={addExtra}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700"
            >
              Add
            </button>
          </div>
          {extras.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extras.map((extra) => (
                <span
                  key={extra}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700"
                >
                  {extra}
                  <button
                    type="button"
                    onClick={() => removeExtra(extra)}
                    aria-label={`Remove ${extra}`}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
