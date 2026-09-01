// Backend counterpart to frontend/src/utils/businessDate.ts.
//
// BUG THIS FIXES: export.service.ts used `new Date().toLocaleDateString('en-IN')`
// for the "Generated:" timestamp on reports. toLocaleDateString without an
// explicit `timeZone` option formats using the SERVER's system timezone —
// which is UTC on most cloud hosts, not IST. Near IST midnight (i.e.
// 18:30-23:59 UTC), a report generated at, say, 00:15 IST would show
// "Generated: [yesterday's UTC date]" instead of today — misleading on a
// financial document.
//
// This does NOT affect entry_financials or work_entries date storage
// (those are @db.Date columns supplied explicitly by the client/query, not
// derived from "now" on the server) — only display of the generation
// timestamp itself.

const BUSINESS_TIMEZONE = 'Asia/Kolkata';

const businessDateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

export function formatBusinessDate(date: Date): string {
  return businessDateFormatter.format(date);
}

export function getBusinessTodayLabel(): string {
  return formatBusinessDate(new Date());
}
