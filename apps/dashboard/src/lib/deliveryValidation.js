// Shared between POST /api/deliveries (new schedule) and PUT
// /api/deliveries/[deliveryId] (reschedule/edit) -- both need to validate
// a scheduled date and, when an address is present, the vendor's own
// configured delivery-area restriction, using the exact same rules so a
// reschedule can't be held to a looser standard than the original
// schedule.

// Africa/Lagos, fixed UTC+1, no DST -- same convention already used for
// the made-to-order daily-count reset elsewhere in this app. "Today"
// means the vendor's actual calendar day, not the server's UTC one.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export function validateScheduledDate(rawValue) {
  const date = rawValue ? new Date(rawValue) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { date: null, error: 'A valid delivery date is required' };
  }

  const nowLagos = new Date(Date.now() + LAGOS_OFFSET_MS);
  const startOfTodayLagos = new Date(
    Date.UTC(nowLagos.getUTCFullYear(), nowLagos.getUTCMonth(), nowLagos.getUTCDate()) - LAGOS_OFFSET_MS
  );

  if (date < startOfTodayLagos) {
    return { date: null, error: 'Delivery date cannot be in the past' };
  }

  return { date, error: null };
}

// Mirrors apps/store/src/app/api/orders/create/route.js's own
// deliverability check (its own comment: "the actual enforcement point,"
// since a client-side dropdown is trivially bypassable) -- empty/unset
// delivery_states means "delivers everywhere"; a non-empty list restricts
// to exactly those states.
export function isStateDeliverable(deliveryStates, state) {
  if (!deliveryStates || deliveryStates.length === 0) return true;
  if (!state) return true;
  return deliveryStates.includes(state);
}

// Same Lagos-day boundary the date validation above uses, exposed as a
// [start, end) range for the morning delivery-digest cron -- "today" has
// to mean the same calendar day there as it does when a delivery was
// originally scheduled, not the server's UTC day.
export function getTodayLagosBounds() {
  const nowLagos = new Date(Date.now() + LAGOS_OFFSET_MS);
  const startOfTodayLagos = new Date(
    Date.UTC(nowLagos.getUTCFullYear(), nowLagos.getUTCMonth(), nowLagos.getUTCDate()) - LAGOS_OFFSET_MS
  );
  const startOfTomorrowLagos = new Date(startOfTodayLagos.getTime() + 24 * 60 * 60 * 1000);
  return { start: startOfTodayLagos, end: startOfTomorrowLagos };
}
