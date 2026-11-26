/*
 * Dates and times, said the way the mockups say them.
 *
 * The caregiver screens are full of relative time -- "Today, 14:00",
 * "Yesterday, 14:20", "Thu, 10:30" -- and every one of those is a place where
 * an off-by-one timezone slip puts a visit on the wrong day. Keeping them in
 * one file means there is one thing to get right and one thing to test.
 *
 * Everything here works in the device's local timezone on purpose. A caregiver
 * in Nairobi reads "14:00" as the time they are standing on a doorstep, not as
 * a UTC instant, and the service stores the instant.
 */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n) => String(n).padStart(2, '0');

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Midnight at the start of the day `d` falls on, locally. */
function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Whole days between two instants, counted by calendar day rather than by
 * elapsed hours.
 *
 * 23:30 last night and 00:30 this morning are one day apart even though they
 * are an hour apart, and that is the answer the UI wants: one of them is
 * "Yesterday".
 */
export function dayOffset(value, from = new Date()) {
  const d = toDate(value);
  if (!d) return null;
  const ms = startOfDay(d) - startOfDay(from);
  return Math.round(ms / 86400000);
}

/** 24-hour clock, which is what the mockups use and what avoids am/pm misreads. */
export function time(value) {
  const d = toDate(value);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '--:--';
}

/** "Today", "Tomorrow", "Yesterday", or "Thu" / "12 Jan 2026" further out. */
export function day(value, { long = false } = {}) {
  const d = toDate(value);
  if (!d) return '';
  const offset = dayOffset(d);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === -1) return 'Yesterday';
  // Inside the coming or passing week, the weekday alone is enough to place it.
  if (offset > 1 && offset <= 6) return long ? LONG_DAYS[d.getDay()] : DAYS[d.getDay()];
  if (offset < -1 && offset >= -6) return `Last ${long ? LONG_DAYS[d.getDay()] : DAYS[d.getDay()]}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Today, 14:00" — the schedule row and the profile card. */
export function dayAndTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return `${day(d)}, ${time(d)}`;
}

/** "Wednesday, 9 September 2026" — the dashboard's date line. */
export function longDate(value = new Date()) {
  const d = toDate(value);
  if (!d) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  return `${LONG_DAYS[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** "9 Sep 2026" — the visit report's subtitle. */
export function shortDate(value = new Date()) {
  const d = toDate(value);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 Jan 2026" from a plain YYYY-MM-DD, with no timezone shift. */
export function isoDay(value) {
  if (!value) return '';
  const [y, m, dd] = String(value).split('-').map(Number);
  if (!y || !m || !dd) return String(value);
  return `${dd} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Whole years between a date of birth and today, or null.
 *
 * Counted off the calendar rather than by dividing a span of milliseconds,
 * because the second answer is wrong for anyone whose run of years contains
 * the wrong number of leap days, and it is wrong on their birthday itself --
 * which is the one day somebody is likely to check.
 *
 * Only the date part is read, so a `YYYY-MM-DD` from the service and a full
 * timestamp give the same answer and neither shifts across a timezone.
 */
export function yearsOld(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const monthsIn = now.getMonth() + 1 - m;
  if (monthsIn < 0 || (monthsIn === 0 && now.getDate() < d)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** "Good morning" / "Good afternoon" / "Good evening". */
export function greeting(value = new Date()) {
  const h = (toDate(value) || new Date()).getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** How long a visit lasted, as "1h 07m". Null until both ends exist. */
export function duration(startValue, endValue) {
  const a = toDate(startValue);
  const b = toDate(endValue);
  if (!a || !b || b < a) return null;
  const minutes = Math.round((b - a) / 60000);
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${pad(minutes % 60)}m` : `${minutes}m`;
}

/** Initials for the avatar tile: "Margaret Wanjiku" becomes "MW". */
export function initials(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
