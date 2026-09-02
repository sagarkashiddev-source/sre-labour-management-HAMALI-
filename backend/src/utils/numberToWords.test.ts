import { describe, it, expect } from 'vitest';
import { amountInWordsIndian, amountInWordsRupeesOnly } from './numberToWords';

describe('amountInWordsIndian', () => {
  it('matches the real April 2026 bill total exactly (320311)', () => {
    // Ground truth from S_R_ENTERPRISES_APRIL_2026: subtotal 271450 + GST
    // 48861 = TOTAL 320311, printed as "THREE LAHK TWENTY THOUSAND THREE
    // HUNDRED AND ELEVEN Rs ONLY" (source spells LAKH as "LAHK" — a typo
    // we intentionally don't reproduce).
    expect(amountInWordsIndian(320311)).toBe('THREE LAKH TWENTY THOUSAND THREE HUNDRED AND ELEVEN');
  });

  it('handles zero', () => {
    expect(amountInWordsIndian(0)).toBe('ZERO');
  });

  it('handles a value under one hundred', () => {
    expect(amountInWordsIndian(45)).toBe('FORTY FIVE');
  });

  it('handles an exact hundred with no remainder (no dangling "AND")', () => {
    expect(amountInWordsIndian(500)).toBe('FIVE HUNDRED');
  });

  it('uses Indian grouping (lakh/crore), not Western (million)', () => {
    // 12,34,567 = 12 lakh 34 thousand 567, not "1 million 234 thousand".
    expect(amountInWordsIndian(1234567)).toBe('TWELVE LAKH THIRTY FOUR THOUSAND FIVE HUNDRED AND SIXTY SEVEN');
  });

  it('rounds to the nearest rupee rather than spelling out paise', () => {
    expect(amountInWordsIndian(99.6)).toBe(amountInWordsIndian(100));
  });
});

describe('amountInWordsRupeesOnly', () => {
  it('appends "Rs ONLY" the way the real bill does', () => {
    expect(amountInWordsRupeesOnly(320311)).toBe('THREE LAKH TWENTY THOUSAND THREE HUNDRED AND ELEVEN Rs ONLY');
  });
});
