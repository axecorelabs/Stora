// Single source of truth for a store's weekly opening hours -- the day
// list/labels, the per-day shape ({closed, open, close}, open/close as
// "HH:MM" 24h strings), and the formatting used to display them. Shared
// between apps/dashboard (the edit form) and apps/store (the storefront
// footer) so both read/write the exact same shape instead of drifting.
export const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' }
];

// A day with no data at all (never touched by the vendor) defaults to
// "open, no times set yet" rather than "closed" -- on the edit form that
// means every day starts toggled on with empty time fields prompting the
// vendor to fill them in, rather than requiring them to also flip a
// closed/open switch before they can type anything.
export const DEFAULT_DAY_HOURS = { closed: false, open: '', close: '' };

function formatTime(time) {
  if (!time || typeof time !== 'string' || !time.includes(':')) return '';
  const [hourStr, minute] = time.split(':');
  const hour = parseInt(hourStr, 10);
  if (Number.isNaN(hour)) return '';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

// Null means "no real data for this day" (as opposed to "Closed", a real,
// vendor-set fact) -- callers decide how to handle that distinction (the
// dashboard's read-only view says "Not set", the storefront footer skips
// the whole section if every day comes back null).
export function formatDayHours(dayHours) {
  if (!dayHours) return null;
  if (dayHours.closed) return 'Closed';
  if (!dayHours.open || !dayHours.close) return null;
  return `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`;
}

// True once at least one day has been genuinely configured (marked closed,
// or given both open and close times) -- distinguishes a vendor who's
// actually set their hours from the all-days-default-empty object every
// store implicitly starts with.
export function hasConfiguredBusinessHours(businessHours) {
  if (!businessHours || typeof businessHours !== 'object') return false;
  return DAYS_OF_WEEK.some(({ key }) => formatDayHours(businessHours[key]) !== null);
}

// Africa/Lagos, fixed UTC+1, no DST -- same convention already used
// elsewhere (made-to-order daily counts, the delivery digest's day
// boundary) for "what day/time is it for this vendor right now."
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

// Derives real-time open/closed status from the weekly schedule plus the
// manual "temporarily closed" override -- nothing computed this before,
// the schedule was purely descriptive (a footer listing) until now.
// `temporarilyClosed` always wins (a vendor closing unexpectedly can't be
// represented by the weekly grid at all). A store that's never configured
// hours reads as always open -- same "no data = don't restrict" rule
// hasConfiguredBusinessHours already uses, so a vendor who hasn't touched
// this section isn't accidentally blocked from selling.
export function isStoreOpenNow(businessHours, temporarilyClosed, now = new Date()) {
  if (temporarilyClosed) {
    return { isOpen: false, reason: 'manual' };
  }
  if (!hasConfiguredBusinessHours(businessHours)) {
    return { isOpen: true, reason: null };
  }

  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const jsDay = lagosNow.getUTCDay(); // 0=Sun..6=Sat
  const dayKey = DAYS_OF_WEEK[(jsDay + 6) % 7].key; // re-index to our Monday-first array
  const todayHours = businessHours?.[dayKey];

  if (!todayHours || todayHours.closed) {
    return { isOpen: false, reason: 'schedule' };
  }
  if (!todayHours.open || !todayHours.close) {
    // Today specifically has no real times set -- don't block on an
    // incomplete entry, same reasoning as the store-wide "not configured" case.
    return { isOpen: true, reason: null };
  }

  const minutesNow = lagosNow.getUTCHours() * 60 + lagosNow.getUTCMinutes();
  const [openH, openM] = todayHours.open.split(':').map(Number);
  const [closeH, closeM] = todayHours.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // closeMinutes <= openMinutes means an overnight span (e.g. 20:00 -> 02:00).
  const isOpen = closeMinutes > openMinutes
    ? (minutesNow >= openMinutes && minutesNow < closeMinutes)
    : (minutesNow >= openMinutes || minutesNow < closeMinutes);

  return { isOpen, reason: isOpen ? null : 'schedule' };
}
