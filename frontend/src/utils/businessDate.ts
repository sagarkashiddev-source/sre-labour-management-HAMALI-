// Centralized "what is today's business date" logic.
//
// BUG THIS FIXES: `new Date().toISOString().slice(0, 10)` was used in
// several places to get "today" as YYYY-MM-DD. toISOString() ALWAYS
// converts to UTC first. IST is UTC+5:30, so for any device-local time
// between 00:00 and 05:29 IST, the UTC instant is still on the PREVIOUS
// calendar day — toISOString().slice(0,10) silently returns yesterday's
// date. A Labour worker logging an entry at 12:30 AM IST would have had
// it default-dated to the day before, and the Admin dashboard's "Today"
// card / Attendance's default date would show yesterday's data until
// 5:30 AM IST every single day.
//
// The business (S.R. Logistics / SRE) operates in India, so "today" must
// always mean the calendar day in Asia/Kolkata — not the UTC day, and not
// whatever timezone a particular device happens to be set to.

const BUSINESS_TIMEZONE = 'Asia/Kolkata';

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Formats any Date/instant as YYYY-MM-DD in the business's timezone (IST). */
export function formatBusinessDate(date: Date): string {
  // en-CA locale happens to format as YYYY-MM-DD directly.
  return businessDateFormatter.format(date);
}

/** Today's date as YYYY-MM-DD, correct in IST regardless of device timezone. */
export function getBusinessToday(): string {
  return formatBusinessDate(new Date());
}
