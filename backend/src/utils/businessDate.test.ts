import { describe, it, expect } from 'vitest';
import { formatBusinessDate } from './businessDate';

describe('formatBusinessDate', () => {
  it('formats using Asia/Kolkata, not the host system timezone', () => {
    // 2026-01-15T19:00:00Z is 2026-01-16 00:30 IST — the exact "near IST
    // midnight" case this module's doc comment says the old
    // toLocaleDateString() call got wrong on a UTC server: it would show
    // the 15th (UTC's date) instead of the 16th (IST's date).
    const nearMidnightIST = new Date('2026-01-15T19:00:00Z');
    const formatted = formatBusinessDate(nearMidnightIST);
    expect(formatted).toContain('16');
    expect(formatted).not.toMatch(/\b15\b/);
  });

  it('formats a plain midday UTC date as the same calendar day in IST', () => {
    const middayUTC = new Date('2026-06-10T08:00:00Z'); // 13:30 IST, same day
    expect(formatBusinessDate(middayUTC)).toContain('10');
  });
});
