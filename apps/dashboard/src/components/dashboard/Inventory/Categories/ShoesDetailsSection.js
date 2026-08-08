"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function ShoesDetailsSection({
  shoesDetails,
  handleCategoryDetailChange,
  handleArrayFieldChange,
  removeArrayItem,
  hasDetectedVariants // New prop to check if variants are detected
}) {
  const [newColor, setNewColor] = useState('');

  if (!shoesDetails) return null;

  // Predefined color options for shoes
  const predefinedColors = [
    'Black', 'White', 'Brown', 'Tan', 'Navy', 'Gray', 'Red', 'Blue',
    'Green', 'Beige', 'Gold', 'Silver', 'Pink', 'Yellow', 'Orange'
  ];

  const addColor = () => {
    if (newColor.trim() && !shoesDetails.colors.includes(newColor.trim())) {
      handleArrayFieldChange('shoes', 'colors', newColor.trim());
      setNewColor('');
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Shoe Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            For who?
          </label>
          <CustomDropdown
            options={[
              { value: 'Men', label: 'Men' },
              { value: 'Women', label: 'Women' },
              { value: 'Unisex', label: 'Unisex' },
              { value: 'Kids', label: 'Kids' },
              { value: 'Babies', label: 'Babies' }
            ]}
            value={shoesDetails.gender}
            onChange={(value) => handleCategoryDetailChange('shoes', 'gender', value)}
            placeholder="Select gender"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type of shoe
          </label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Sneakers', label: 'Sneakers' },
              { value: 'Sandals', label: 'Sandals' },
              { value: 'Slippers', label: 'Slippers' },
              { value: 'Boots', label: 'Boots' },
              { value: 'Heels', label: 'Heels' },
              { value: 'Sports shoes', label: 'Sports shoes' },
              { value: 'Other', label: 'Other' }
            ]}
            value={shoesDetails.shoeType}
            onChange={(value) => handleCategoryDetailChange('shoes', 'shoeType', value)}
            placeholder="Select shoe type"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Material
          </label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select material' },
              { value: 'Leather', label: 'Leather' },
              { value: 'Canvas', label: 'Canvas' },
              { value: 'Rubber', label: 'Rubber' },
              { value: 'Synthetic', label: 'Synthetic' },
              { value: 'Mixed', label: 'Mixed' },
              { value: 'Other', label: 'Other' }
            ]}
            value={shoesDetails.material}
            onChange={(value) => handleCategoryDetailChange('shoes', 'material', value)}
            placeholder="Select material"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Occasions (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['Casual', 'Office/Corporate', 'Party', 'Sports/Fitness', 'Outdoor', 'Beach', 'Owambe', 'Wedding', 'Church/Religious', 'Formal Event', 'Other'].map(occasion => (
              <button
                key={occasion}
                type="button"
                onClick={() => {
                  const occasions = shoesDetails.occasion || [];
                  if (occasions.includes(occasion)) {
                    handleCategoryDetailChange('shoes', 'occasion', occasions.filter(o => o !== occasion));
                  } else {
                    handleCategoryDetailChange('shoes', 'occasion', [...occasions, occasion]);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (shoesDetails.occasion || []).includes(occasion)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {occasion}
              </button>
            ))}
          </div>
        </div>

        {/* Available Colors */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Available Colors *
          </label>
          <p className="text-xs text-gray-500 mb-3">Add colors that this shoe comes in</p>
          
          {/* Quick Add Predefined Colors */}
          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-700 mb-2">Quick add popular colors:</p>
            <div className="flex flex-wrap gap-2">
              {predefinedColors.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    if (!shoesDetails.colors.includes(color)) {
                      handleArrayFieldChange('shoes', 'colors', color);
                    }
                  }}
                  disabled={shoesDetails.colors.includes(color)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    shoesDetails.colors.includes(color)
                      ? 'bg-teal-100 text-teal-700 cursor-not-allowed'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-teal-500 hover:text-teal-600'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Color Input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())}
              placeholder="Or type a custom color"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
            />
            <button
              type="button"
              onClick={addColor}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {/* Selected Colors */}
          <div className="flex flex-wrap gap-2">
            {shoesDetails.colors.map((color, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium"
              >
                {color}
                <button
                  type="button"
                  onClick={() => removeArrayItem('shoes', 'colors', index)}
                  className="ml-2 text-teal-600 hover:text-teal-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {shoesDetails.colors.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              💡 Add at least one color to enable variant system
            </p>
          )}
        </div>

        {/* Available Sizes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Available Sizes
          </label>
          
          {hasDetectedVariants ? (
            // Read-only view when variants are detected
            <>
              <p className="text-xs text-gray-500 mb-3">
                Sizes are automatically compiled from your variants. Manage sizes in the variant manager above.
              </p>
              
              {shoesDetails.sizes.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">
                    No sizes added yet. Add sizes in the variant manager above.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {shoesDetails.sizes.map((size, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200"
                    >
                      {size}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Interactive view when no variants detected
            <>
              <p className="text-xs text-gray-500 mb-3">
                Select all sizes available for this shoe
              </p>
              <div className="flex flex-wrap gap-2">
                {['One Size', '38', '39', '40', '41', '42', '43', '44', '45'].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      if (shoesDetails.sizes.includes(size)) {
                        const index = shoesDetails.sizes.indexOf(size);
                        removeArrayItem('shoes', 'sizes', index);
                      } else {
                        handleArrayFieldChange('shoes', 'sizes', size);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      shoesDetails.sizes.includes(size)
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
