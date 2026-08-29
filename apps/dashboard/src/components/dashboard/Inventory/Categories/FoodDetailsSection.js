"use client";
import { useState } from "react";
import { X } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { normalizeExtraDefinitions } from "@stora/shared-constants";

export default function FoodDetailsSection({
  foodDetails,
  handleCategoryDetailChange
}) {
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraPrice, setNewExtraPrice] = useState('');
  const [newExtraMaxQuantity, setNewExtraMaxQuantity] = useState('1');
  const [newIngredient, setNewIngredient] = useState('');

  if (!foodDetails) return null;

  // Normalized here (not just at save time) so legacy plain-string extras
  // from before pricing existed still render correctly -- price 0,
  // maxQuantity 1, same as they behaved as a simple on/off pick before.
  const extras = normalizeExtraDefinitions(foodDetails.extras);
  const ingredients = foodDetails.ingredients || [];
  const cuisineType = foodDetails.cuisineType || [];
  const deliveryTime = foodDetails.deliveryTime || { value: '', unit: 'minutes' };

  const addExtra = () => {
    const name = newExtraName.trim();
    if (!name || extras.some(e => e.name === name)) return;
    handleCategoryDetailChange('food', 'extras', [
      ...extras,
      { name, price: newExtraPrice, maxQuantity: newExtraMaxQuantity }
    ]);
    setNewExtraName('');
    setNewExtraPrice('');
    setNewExtraMaxQuantity('1');
  };

  // Keyed by index, not name -- editing the name field itself would make
  // name-based matching ambiguous mid-edit (two rows momentarily blank or
  // identical while typing).
  const updateExtraAt = (index, field, value) => {
    handleCategoryDetailChange('food', 'extras', extras.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const removeExtraAt = (index) => {
    handleCategoryDetailChange('food', 'extras', extras.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    const value = newIngredient.trim();
    if (!value || ingredients.includes(value)) return;
    handleCategoryDetailChange('food', 'ingredients', [...ingredients, value]);
    setNewIngredient('');
  };

  const removeIngredient = (ingredient) => {
    handleCategoryDetailChange('food', 'ingredients', ingredients.filter(i => i !== ingredient));
  };

  const toggleCuisineType = (cuisine) => {
    if (cuisineType.includes(cuisine)) {
      handleCategoryDetailChange('food', 'cuisineType', cuisineType.filter(c => c !== cuisine));
    } else {
      handleCategoryDetailChange('food', 'cuisineType', [...cuisineType, cuisine]);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Food Details
      </h3>

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

        {/* Which section of the menu this item belongs under -- what
            Restaurant Mode's storefront menu (StoreMenuWebsite.js) groups
            by, since foodType is a dish style ("Fast Food"), not a course. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Menu Section</label>
          <CustomDropdown
            options={[
              { value: 'Other', label: 'Other' },
              { value: 'Starters', label: 'Starters' },
              { value: 'Mains', label: 'Mains' },
              { value: 'Sides', label: 'Sides' },
              { value: 'Desserts', label: 'Desserts' },
              { value: 'Drinks', label: 'Drinks' }
            ]}
            value={foodDetails.menuSection || 'Other'}
            onChange={(value) => handleCategoryDetailChange('food', 'menuSection', value)}
            placeholder="Select menu section"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Serving Size</label>
          <input
            type="text"
            value={foodDetails.servingSize}
            onChange={(e) => handleCategoryDetailChange('food', 'servingSize', e.target.value)}
            placeholder="e.g., 1 person, 2-3 people, Family pack"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
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
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
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

        {/* How long it typically takes to prepare/deliver -- already
            rendered on the storefront's product detail page, had no input
            here until now. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Delivery/Prep Time</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={deliveryTime.value}
              onChange={(e) => handleCategoryDetailChange('food', 'deliveryTime', { ...deliveryTime, value: e.target.value })}
              placeholder="e.g., 30"
              min="0"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
            <div className="w-36 shrink-0">
              <CustomDropdown
                options={[
                  { value: 'minutes', label: 'Minutes' },
                  { value: 'hours', label: 'Hours' }
                ]}
                value={deliveryTime.unit || 'minutes'}
                onChange={(value) => handleCategoryDetailChange('food', 'deliveryTime', { ...deliveryTime, unit: value })}
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cuisine Type (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {['Nigerian', 'Continental', 'Chinese', 'Indian', 'Fast Food', 'Other'].map(cuisine => (
              <button
                key={cuisine}
                type="button"
                onClick={() => toggleCuisineType(cuisine)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  cuisineType.includes(cuisine)
                    ? 'bg-brand-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cuisine}
              </button>
            ))}
          </div>
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
                    ? 'bg-brand-800 text-white'
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
            Ingredients (optional -- helps shoppers with dietary needs)
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addIngredient();
                }
              }}
              placeholder="e.g. Rice"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
            <button
              type="button"
              onClick={addIngredient}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-800 text-white hover:bg-brand-900"
            >
              Add
            </button>
          </div>
          {ingredients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ingredients.map((ingredient) => (
                <span
                  key={ingredient}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700"
                >
                  {ingredient}
                  <button
                    type="button"
                    onClick={() => removeIngredient(ingredient)}
                    aria-label={`Remove ${ingredient}`}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Extras (optional priced add-ons buyers can pick, e.g. Extra sausage +₦200, up to 3)
          </label>

          {extras.length > 0 && (
            <div className="space-y-2 mb-3">
              <div className="hidden sm:grid grid-cols-[1fr_140px_110px_auto] gap-2 px-1 text-xs font-medium text-gray-500">
                <span>Name</span>
                <span>Price (₦ each)</span>
                <span>Max per item</span>
                <span></span>
              </div>
              {extras.map((extra, index) => (
                <div key={index} className="grid grid-cols-2 sm:grid-cols-[1fr_140px_110px_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={extra.name}
                    onChange={(e) => updateExtraAt(index, 'name', e.target.value)}
                    placeholder="e.g. Extra sausage"
                    className="col-span-2 sm:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                  <input
                    type="number"
                    value={extra.price}
                    onChange={(e) => updateExtraAt(index, 'price', e.target.value)}
                    min="0"
                    placeholder="0"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                  <input
                    type="number"
                    value={extra.maxQuantity}
                    onChange={(e) => updateExtraAt(index, 'maxQuantity', e.target.value)}
                    min="1"
                    placeholder="1"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                  <button
                    type="button"
                    onClick={() => removeExtraAt(index)}
                    aria-label={`Remove ${extra.name || 'extra'}`}
                    className="justify-self-end sm:justify-self-start text-gray-400 hover:text-red-600 p-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-[1fr_140px_110px_auto] gap-2 items-center">
            <input
              type="text"
              value={newExtraName}
              onChange={(e) => setNewExtraName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExtra();
                }
              }}
              placeholder="e.g. Extra sausage"
              className="col-span-2 sm:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
            <input
              type="number"
              value={newExtraPrice}
              onChange={(e) => setNewExtraPrice(e.target.value)}
              min="0"
              placeholder="Price"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
            <input
              type="number"
              value={newExtraMaxQuantity}
              onChange={(e) => setNewExtraMaxQuantity(e.target.value)}
              min="1"
              placeholder="Max"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
            <button
              type="button"
              onClick={addExtra}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-800 text-white hover:bg-brand-900 whitespace-nowrap"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
