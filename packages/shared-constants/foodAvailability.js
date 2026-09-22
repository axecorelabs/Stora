// A vendor-declared "we ran out of this today" flag for a food/menu item --
// separate from stock counts and the made-to-order daily cap, which are
// both about how many can be sold, not whether the vendor has manually
// 86'd it. Lives at inventory.category_details.food.unavailableToday (+
// .unavailableMarkedAt), set through the same handleCategoryDetailChange
// path every other food field already uses (FoodDetailsSection.js).
//
// Auto-resets the next day with no write needed: `unavailableMarkedAt` is
// checked against the current Africa/Lagos calendar day, not just the raw
// boolean, so a vendor who forgets to turn it back on doesn't leave an
// item permanently unavailable. Same fixed UTC+1, no-DST convention as
// isStoreOpenNow (businessHours.js) and the made-to-order daily count.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

function lagosDateKey(date) {
  const lagos = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return `${lagos.getUTCFullYear()}-${lagos.getUTCMonth()}-${lagos.getUTCDate()}`;
}

export function isMarkedUnavailableToday(foodDetails, now = new Date()) {
  if (!foodDetails?.unavailableToday || !foodDetails?.unavailableMarkedAt) return false;
  const markedAt = new Date(foodDetails.unavailableMarkedAt);
  if (Number.isNaN(markedAt.getTime())) return false;
  return lagosDateKey(markedAt) === lagosDateKey(now);
}
