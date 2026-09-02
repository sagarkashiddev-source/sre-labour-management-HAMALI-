// Converts a rupee amount to words using the Indian numbering system
// (Lakh/Crore, not Million/Billion) — matches the real bill format:
// "271450" (with paise ignored, matching the source PDF's whole-rupee
// bills) -> "TWO LAKH SEVENTY ONE THOUSAND FOUR HUNDRED AND FIFTY".
//
// The source bill spells it "LAHK" (a typo for LAKH) — we use the correct
// spelling here rather than reproducing the typo.

const ONES = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
];
const TENS = [
  '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY',
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return twoDigits(rest);
  const restWords = rest ? ` AND ${twoDigits(rest)}` : '';
  return `${ONES[hundreds]} HUNDRED${restWords}`;
}

/**
 * Whole-rupee amount to words, Indian numbering (Crore/Lakh/Thousand).
 * Rounds to the nearest rupee — the real bill format doesn't spell out
 * paise ("... THREE HUNDRED AND ELEVEN Rs ONLY", not "... 11.00 Rs").
 */
export function amountInWordsIndian(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'ZERO';

  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1_000);
  const hundred = n % 1_000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} CRORE`);
  if (lakh) parts.push(`${threeDigits(lakh)} LAKH`);
  if (thousand) parts.push(`${threeDigits(thousand)} THOUSAND`);
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(' ');
}

/** "THREE LAKH TWENTY THOUSAND THREE HUNDRED AND ELEVEN Rs ONLY" */
export function amountInWordsRupeesOnly(amount: number): string {
  return `${amountInWordsIndian(amount)} Rs ONLY`;
}
