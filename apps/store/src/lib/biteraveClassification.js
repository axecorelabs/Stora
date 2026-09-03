// A vendor who fills in foodType (and, by extension, the rest of the
// menu-item sub-schema -- cuisineType, spiceLevel, menuSection,
// deliveryTime) is demonstrably building a real menu item; a vendor who
// leaves it blank picked "Food" as the closest matching top-level category
// for a grocery/pantry item and never touched the food-specific fields.
// Confirmed against real data: every one of Dotun's Store's 6 Food
// products has foodType populated (Fast Food / Traditional Nigerian
// Dishes / Snacks & Small Chops -- genuine menu items); every one of
// Samstell Goshen Express Mart's 67 Food products has it blank (rice,
// palm oil, kilishi, crayfish -- genuine grocery stock). No new DB column
// needed -- this reads data that already exists.
export function isMealItem(product) {
  return Boolean(product?.categoryDetails?.food?.foodType?.trim());
}

export const BITERAVE_TYPES = ["meals", "groceries"];
export const DEFAULT_BITERAVE_TYPE = "meals";

export function normalizeBiteraveType(type) {
  return BITERAVE_TYPES.includes(type) ? type : DEFAULT_BITERAVE_TYPE;
}
