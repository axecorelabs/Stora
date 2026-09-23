"use client";
import { useState } from "react";
import { X, Trash2, Plus } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { normalizeExtraDefinitions, isMarkedUnavailableToday } from "@stora/shared-constants";

export default function FoodDetailsSection({
  foodDetails,
  handleCategoryDetailChange,
  maxOrdersPerDayError
}) {
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraPrice, setNewExtraPrice] = useState('');
  const [newExtraMaxQuantity, setNewExtraMaxQuantity] = useState('1');
  const [newIngredient, setNewIngredient] = useState('');

  if (!foodDetails) return null;

  // Computed, not the raw stored flag -- a vendor who marked this
  // unavailable yesterday and never flipped it back should see it as
  // available again today, not a stale "on" toggle (see
  // isMarkedUnavailableToday's own comment for the auto-reset logic).
  const isUnavailableToday = isMarkedUnavailableToday(foodDetails);

  const setUnavailableToday = (unavailable) => {
    handleCategoryDetailChange('food', 'unavailableToday', unavailable);
    handleCategoryDetailChange('food', 'unavailableMarkedAt', unavailable ? new Date().toISOString() : null);
  };

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

      {/* Vendor-declared "ran out today" -- separate from stock counts and
          the made-to-order daily cap below, which are both about how many
          can be sold rather than whether this specific dish is off today.
          Auto-resets tomorrow with no action needed (see
          isMarkedUnavailableToday's own comment). */}
      <div className={`flex items-center justify-between gap-4 p-4 border rounded-xl mb-6 ${
        isUnavailableToday ? 'border-red-200 bg-red-50' : 'border-gray-200'
      }`}>
        <div>
          <p className="text-sm font-medium text-gray-900">Mark unavailable today</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Ran out of this dish? Hide it from ordering until tomorrow -- it comes back automatically, no need to remember to switch it back.
          </p>
        </div>
        <label className="relative inline-flex items-center shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={isUnavailableToday}
            onChange={(e) => setUnavailableToday(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
        </label>
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

        {/* Made to order -- unlimited stock, gated by a real per-day order
            cap instead of a quantityInStock number that never made sense
            for a dish that's cooked fresh per order (see
            20260915000000_made_to_order_menu_items.sql). Off by default,
            same as before -- a vendor who doesn't touch this keeps today's
            fixed-quantity behavior exactly as it was. */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between gap-4 p-4 border border-gray-200 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-900">Made to order</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Cooked fresh per order, not from a fixed stock count -- capped by how many you can make in a day instead of how many you have on hand.
              </p>
            </div>
            <label className="relative inline-flex items-center shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={!!foodDetails.madeToOrder}
                onChange={(e) => handleCategoryDetailChange('food', 'madeToOrder', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-800"></div>
            </label>
          </div>

          {foodDetails.madeToOrder && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Orders Per Day *</label>
              <input
                type="number"
                value={foodDetails.maxOrdersPerDay}
                onChange={(e) => handleCategoryDetailChange('food', 'maxOrdersPerDay', e.target.value)}
                placeholder="e.g., 50"
                min="1"
                className={`w-full max-w-xs px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                  maxOrdersPerDayError ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {maxOrdersPerDayError ? (
                <p className="text-red-500 text-xs mt-1">{maxOrdersPerDayError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Once this many are ordered today, it shows as sold out until tomorrow.</p>
              )}
            </div>
          )}
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
          {/* Fixed narrow widths, not flex-1 on the number input -- an
              unconstrained flex item's default min-width is its intrinsic
              browser-rendered size, which for a bare <input> is wider than
              it looks and was pushing this row past its column, causing
              horizontal overflow. */}
          <div className="flex gap-2">
            <input
              type="number"
              value={deliveryTime.value}
              onChange={(e) => handleCategoryDetailChange('food', 'deliveryTime', { ...deliveryTime, value: e.target.value })}
              placeholder="e.g., 30"
              min="0"
              className="w-20 min-w-0 shrink-0 px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
            <div className="w-28 shrink-0">
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
              {/* Card-grouped on mobile (name on its own line, price/max/
                  delete together in one row right below it) so the delete
                  button reads as belonging to this extra, not an orphaned
                  control on its own line. sm:contents un-wraps the price/
                  max/delete group back into the grid's own 4 columns at
                  sm: and up, matching the flat single-row layout there. */}
              {extras.map((extra, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 p-3 border border-gray-200 rounded-xl sm:grid sm:grid-cols-[1fr_140px_110px_auto] sm:items-center sm:gap-2 sm:p-0 sm:border-0 sm:rounded-none"
                >
                  <input
                    type="text"
                    value={extra.name}
                    onChange={(e) => updateExtraAt(index, 'name', e.target.value)}
                    placeholder="e.g. Extra sausage"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                  <div className="flex items-center gap-2 sm:contents">
                    <input
                      type="number"
                      value={extra.price}
                      onChange={(e) => updateExtraAt(index, 'price', e.target.value)}
                      min="0"
                      placeholder="0"
                      className="flex-1 min-w-0 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                    />
                    <input
                      type="number"
                      value={extra.maxQuantity}
                      onChange={(e) => updateExtraAt(index, 'maxQuantity', e.target.value)}
                      min="1"
                      placeholder="1"
                      className="flex-1 min-w-0 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraAt(index)}
                      aria-label={`Remove ${extra.name || 'extra'}`}
                      className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dashed border marks this as the entry row, distinct from the
              saved extras above. Same mobile card-grouping fix as those. */}
          <div className="flex flex-col gap-2 p-3 border border-dashed border-gray-300 rounded-xl sm:grid sm:grid-cols-[1fr_140px_110px_auto] sm:items-center sm:gap-2 sm:p-0 sm:border-0 sm:rounded-none">
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
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
            />
            <div className="flex items-center gap-2 sm:contents">
              <input
                type="number"
                value={newExtraPrice}
                onChange={(e) => setNewExtraPrice(e.target.value)}
                min="0"
                placeholder="Price"
                className="flex-1 min-w-0 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
              <input
                type="number"
                value={newExtraMaxQuantity}
                onChange={(e) => setNewExtraMaxQuantity(e.target.value)}
                min="1"
                placeholder="Max"
                className="flex-1 min-w-0 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
              />
              <button
                type="button"
                onClick={addExtra}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand-800 text-white hover:bg-brand-900 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
