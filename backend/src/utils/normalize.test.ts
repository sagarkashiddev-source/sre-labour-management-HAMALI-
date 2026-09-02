import { describe, it, expect } from 'vitest';
import { normalizeVehicleNo, isPlausibleVehicleNo } from './normalize';

describe('normalizeVehicleNo', () => {
  it('uppercases, trims, and strips internal whitespace', () => {
    expect(normalizeVehicleNo(' mh12 ab 1234 ')).toBe('MH12AB1234');
  });

  it('is idempotent — normalizing twice gives the same result', () => {
    const once = normalizeVehicleNo('mh14 hg 5577');
    expect(normalizeVehicleNo(once)).toBe(once);
  });

  it('treats visually-different-but-equivalent inputs as the same vehicle', () => {
    // The exact real-world case this exists for: the source workbook had
    // the same vehicle logged inconsistently across rows.
    expect(normalizeVehicleNo('MH14HG5577')).toBe(normalizeVehicleNo('mh14 hg5577'));
    expect(normalizeVehicleNo('MH14HG5577')).toBe(normalizeVehicleNo(' MH14HG5577 '));
  });
});

describe('isPlausibleVehicleNo', () => {
  it.each([
    'MH12AB1234',
    'TN87A7828',
    'MH14HG5577',
    'NL01AE9981',
    'MH4KA5416', // real row from the April bill — 1-digit RTO code, still plausible
  ])('accepts %s as a real-looking plate', (plate) => {
    expect(isPlausibleVehicleNo(normalizeVehicleNo(plate))).toBe(true);
  });

  it.each(['', 'X', '12345', 'ABCDEFGHIJK', '   '])(
    'rejects %j as obvious garbage',
    (garbage) => {
      expect(isPlausibleVehicleNo(normalizeVehicleNo(garbage))).toBe(false);
    },
  );
});
