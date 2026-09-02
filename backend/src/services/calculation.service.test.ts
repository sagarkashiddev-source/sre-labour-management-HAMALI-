import { describe, it, expect } from 'vitest';
import { calculateEntryFinancials, calculatePerPerson } from './calculation.service';
import { Prisma } from '@prisma/client';

// NOTE ON RUNNING THIS FILE: calculateEntryFinancials/calculatePerPerson are
// pure functions, but this module also imports the shared PrismaClient
// singleton (../lib/prisma) at the top of calculation.service.ts, and uses
// Prisma.Decimal internally. Both require a *generated* Prisma client
// (`npm run prisma:generate` against a real network) to import at all —
// this is the same pre-existing sandbox limitation the project's own
// README already documents ("this sandbox can't reach Prisma's binary
// host"). Run `npm run prisma:generate` once before `npm test` if this
// file fails to even load; the assertions below are correct once it can.

describe('calculateEntryFinancials', () => {
  it('reproduces the current (Jun/Jul 2026) two-stage formula from the real bill data', () => {
    // Row from S_R_ENTERPRISES_APRIL_2026 bill: amount 1200, but using the
    // documented current-era rates (10% company, 20% of remainder) as the
    // formula under test — historical April rows used flat rates instead
    // (see the "flat percentage" test below).
    const result = calculateEntryFinancials(1200, 10, 20);
    expect(result.companyDeduction.toString()).toBe('120');
    expect(result.balanceAfterCompany.toString()).toBe('1080');
    expect(result.labourDeduction.toString()).toBe('216'); // 20% of 1080, NOT of 1200
    expect(result.netAmount.toString()).toBe('864');
  });

  it('treats a flat single-rate month (labourDeductionPct = 0) as company-deduction-only', () => {
    // Reproduces the workbook's earlier flat-30% era: only companyDeductionPct
    // is set, labourDeductionPct is 0, so balance === net.
    const result = calculateEntryFinancials(1000, 30, 0);
    expect(result.companyDeduction.toString()).toBe('300');
    expect(result.balanceAfterCompany.toString()).toBe('700');
    expect(result.labourDeduction.toString()).toBe('0');
    expect(result.netAmount.toString()).toBe('700');
  });

  it('handles a zero amount without dividing by zero or going negative', () => {
    const result = calculateEntryFinancials(0, 10, 20);
    expect(result.netAmount.toString()).toBe('0');
  });

  it('rounds each stage to 2 decimal places independently, matching the schema\'s Decimal(10,2) columns', () => {
    const result = calculateEntryFinancials(333, 10, 20);
    // companyDeduction = 33.3 -> rounds to 33.3 already at 1dp, stays as-is
    // balance = 299.7; labourDeduction = 59.94
    expect(result.companyDeduction.toDecimalPlaces(2).toString()).toBe(result.companyDeduction.toString());
    expect(result.labourDeduction.toDecimalPlaces(2).toString()).toBe(result.labourDeduction.toString());
  });

  it('never lets net + both deductions exceed the original amount', () => {
    for (const [amount, companyPct, labourPct] of [
      [1200, 10, 20],
      [2000, 0, 0],
      [500, 100, 50],
      [7.5, 12.5, 33],
    ] as const) {
      const r = calculateEntryFinancials(amount, companyPct, labourPct);
      const reconstructed = r.netAmount.add(r.labourDeduction).add(r.companyDeduction);
      expect(reconstructed.toNumber()).toBeCloseTo(amount, 2);
    }
  });
});

describe('calculatePerPerson', () => {
  it('divides the day\'s net total by the present headcount', () => {
    const total = new Prisma.Decimal(5565);
    expect(calculatePerPerson(total, 9).toString()).toBe('618.33');
  });

  it('throws rather than silently returning Infinity when nobody was present', () => {
    const total = new Prisma.Decimal(1000);
    expect(() => calculatePerPerson(total, 0)).toThrow();
  });

  it('throws on a negative present count (bad data should fail loudly, not compute nonsense)', () => {
    const total = new Prisma.Decimal(1000);
    expect(() => calculatePerPerson(total, -1)).toThrow();
  });
});
