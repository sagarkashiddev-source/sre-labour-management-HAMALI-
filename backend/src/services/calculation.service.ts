import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface CalculationResult {
  amount: Prisma.Decimal;
  companyDeductionPct: Prisma.Decimal;
  companyDeduction: Prisma.Decimal;
  balanceAfterCompany: Prisma.Decimal;
  labourDeductionPct: Prisma.Decimal;
  labourDeduction: Prisma.Decimal;
  netAmount: Prisma.Decimal;
}

/**
 * Reproduces the workbook's current (June/July 2026) calculation exactly:
 *
 *   companyDeduction = amount * companyDeductionPct
 *   balance          = amount - companyDeduction
 *   labourDeduction  = balance * labourDeductionPct   <-- of the BALANCE, not of amount
 *   netAmount        = balance - labourDeduction
 *
 * Earlier months in the workbook (Mar/Apr/May) used a single flat
 * percentage instead — that is the case where labourDeductionPct = 0 and
 * only companyDeductionPct is set, which this same formula already
 * reproduces correctly (balance = net in that case).
 *
 * Percentages are NEVER hardcoded — always pass the values fetched from the
 * active CalculationRule for the entry's date.
 */
export function calculateEntryFinancials(
  amount: number,
  companyDeductionPct: number,
  labourDeductionPct: number,
): CalculationResult {
  const amountD = new Prisma.Decimal(amount);
  const companyPctD = new Prisma.Decimal(companyDeductionPct).div(100);
  const labourPctD = new Prisma.Decimal(labourDeductionPct).div(100);

  const companyDeduction = amountD.mul(companyPctD).toDecimalPlaces(2);
  const balanceAfterCompany = amountD.sub(companyDeduction);
  const labourDeduction = balanceAfterCompany.mul(labourPctD).toDecimalPlaces(2);
  const netAmount = balanceAfterCompany.sub(labourDeduction);

  return {
    amount: amountD,
    companyDeductionPct: new Prisma.Decimal(companyDeductionPct),
    companyDeduction,
    balanceAfterCompany,
    labourDeductionPct: new Prisma.Decimal(labourDeductionPct),
    labourDeduction,
    netAmount,
  };
}

/**
 * Finds the CalculationRule in effect for a given date (the most recent
 * rule whose effectiveFrom <= date). Throws if none exists — we never
 * silently fall back to a hardcoded default.
 */
export async function getActiveRuleForDate(date: Date) {
  const rule = await prisma.calculationRule.findFirst({
    where: { effectiveFrom: { lte: date } },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (!rule) {
    throw new Error(
      `No calculation rule configured that covers ${date.toISOString().slice(0, 10)}. ` +
        'An Admin must set one under Settings -> Calculation Rules before amounts can be entered.',
    );
  }

  return rule;
}

/**
 * Per-person calculation for a given day: NET amount total for the day,
 * divided by the manually recorded present-labour headcount for that day.
 * Present count is NEVER derived from counting entries — see
 * DailyAttendance in schema.prisma.
 */
export function calculatePerPerson(netAmountTotal: Prisma.Decimal, presentCount: number): Prisma.Decimal {
  if (presentCount <= 0) {
    throw new Error('Present labour count must be greater than zero to calculate per-person amount.');
  }
  return netAmountTotal.div(presentCount).toDecimalPlaces(2);
}
