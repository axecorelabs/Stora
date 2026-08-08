"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function AccessoriesDetailsSection({
  accessoriesDetails,
  handleCategoryDetailChange,
  handleArrayFieldChange,
  removeArrayItem
}) {
  const [newColor, setNewColor] = useState('');

  if (!accessoriesDetails) return null;

  // Predefined color options for accessories
  const predefinedColors = [
    'Black', 'White', 'Silver', 'Gold', 'Rose Gold', 'Brown', 'Tan',
    'Red', 'Blue', 'Green', 'Pink', 'Purple', 'Gray', 'Beige'
  ];

  const addColor = () => {
    if (newColor.trim() && !accessoriesDetails.colors.includes(newColor.trim())) {
      handleArrayFieldChange('accessories', 'colors', newColor.trim());
      setNewColor('');
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Accessory Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type of accessory
          </label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Bags', label: 'Bags' },
              { value: 'Handbags', label: 'Handbags' },
              { value: 'Wallets', label: 'Wallets' },
              { value: 'Belts', label: 'Belts' },
              { value: 'Watches', label: 'Watches' },
              { value: 'Jewelry', label: 'Jewelry' },
              { value: 'Sunglasses', label: 'Sunglasses' },
              { value: 'Hats/Caps', label: 'Hats/Caps' },
              { value: 'Other', label: 'Other' }
            ]}
            value={accessoriesDetails.accessoryType}
            onChange={(value) => handleCategoryDetailChange('accessories', 'accessoryType', value)}
            placeholder="Select accessory type"
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
              { value: 'Unisex', label: 'Unisex' },
              { value: 'Kids', label: 'Kids' }
            ]}
            value={accessoriesDetails.gender}
            onChange={(value) => handleCategoryDetailChange('accessories', 'gender', value)}
            placeholder="Select gender"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Material
          </label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select material' },
              { value: 'Leather', label: 'Leather' },
              { value: 'Metal', label: 'Metal' },
              { value: 'Plastic', label: 'Plastic' },
              { value: 'Gold', label: 'Gold' },
              { value: 'Silver', label: 'Silver' },
              { value: 'Stainless Steel', label: 'Stainless Steel' },
              { value: 'Mixed', label: 'Mixed' },
              { value: 'Other', label: 'Other' }
            ]}
            value={accessoriesDetails.material}
            onChange={(value) => handleCategoryDetailChange('accessories', 'material', value)}
            placeholder="Select material"
          />
        </div>

        {/* Non-Tarnish Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Tarnish Resistance
          </label>
          <label className="flex items-center space-x-3 cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={accessoriesDetails.isNonTarnish || false}
              onChange={(e) => handleCategoryDetailChange('accessories', 'isNonTarnish', e.target.checked)}
              className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">Non-Tarnish</span>
              <p className="text-xs text-gray-500 mt-0.5">
                This accessory is tarnish-resistant or hypoallergenic
              </p>
            </div>
          </label>
        </div>

        {/* Available Colors */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Available Colors
          </label>
          <p className="text-xs text-gray-500 mb-3">Add colors that this accessory comes in</p>
          
          {/* Quick Add Predefined Colors */}
          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-700 mb-2">Quick add popular colors:</p>
            <div className="flex flex-wrap gap-2">
              {predefinedColors.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    if (!accessoriesDetails.colors.includes(color)) {
                      handleArrayFieldChange('accessories', 'colors', color);
                    }
                  }}
                  disabled={accessoriesDetails.colors.includes(color)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    accessoriesDetails.colors.includes(color)
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
            {accessoriesDetails.colors.map((color, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium"
              >
                {color}
                <button
                  type="button"
                  onClick={() => removeArrayItem('accessories', 'colors', index)}
                  className="ml-2 text-teal-600 hover:text-teal-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {accessoriesDetails.colors.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              💡 Add at least one color to enable variant system
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
