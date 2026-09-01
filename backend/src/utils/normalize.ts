/**
 * Normalizes a vehicle number the way spec section 33 requires: uppercase,
 * collapse internal whitespace, trim. Applied on every create/update so
 * "mh12 ab1234" and "MH12AB1234" are recognized as the same vehicle for
 * duplicate detection instead of silently diverging like the workbook's
 * TYPE column did (909 / 9090 / 99 / 40FT / 40 FT).
 */
export function normalizeVehicleNo(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

// Loose but useful sanity check for Indian vehicle registration formats
// (e.g. MH12AB1234, TN87A7828, GJ01HT9782). Intentionally permissive —
// reject obvious garbage, not anything that doesn't match a strict pattern,
// since real plates vary (BH-series, older formats, etc).
const VEHICLE_NO_PATTERN = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/;

export function isPlausibleVehicleNo(normalized: string): boolean {
  return VEHICLE_NO_PATTERN.test(normalized);
}
