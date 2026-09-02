import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const zero = () => new Prisma.Decimal(0);
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

export interface DayRow {
  date: string;
  entriesCount: number;
  grossAmount: Prisma.Decimal;
  totalDeduction: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  present: number | null;
  perPerson: Prisma.Decimal | null;
}

/**
 * Only APPROVED entries count toward reports/exports (spec's workflow is
 * Labour creates -> PENDING -> Admin reviews -> APPROVED, and reports are
 * built off finalized numbers, matching the "Show Cancelled Records" /
 * default-excludes-cancelled rule in spec section 21 — PENDING is likewise
 * excluded since its amount may not even be set yet).
 */
const APPROVED: Prisma.WorkEntryWhereInput = { status: 'APPROVED' };

function monthRange(month: number, year: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0)); // last day of month
  return { from, to };
}

/**
 * Per-day breakdown for a date range: gross/deduction/net summed from
 * entry_financials, joined in JS to a manually-recorded daily headcount
 * (DailyAttendance) rather than derived from entry count — the workbook
 * proves those two numbers are NOT the same.
 */
export async function computeDailyRows(from: Date, to: Date): Promise<DayRow[]> {
  const entries = await prisma.workEntry.findMany({
    where: { ...APPROVED, date: { gte: from, lte: to } },
    include: { financial: true },
    orderBy: { date: 'asc' },
  });

  const attendance = await prisma.dailyAttendance.groupBy({
    by: ['date'],
    where: { date: { gte: from, lte: to }, present: true },
    _count: { _all: true },
  });
  const presentMap = new Map(
    attendance.map((a: { date: Date; _count: { _all: number } }) => [dateKey(a.date), a._count._all]),
  );

  const byDay = new Map<
    string,
    { entriesCount: number; gross: Prisma.Decimal; deduction: Prisma.Decimal; net: Prisma.Decimal }
  >();

  for (const entry of entries) {
    if (!entry.financial) continue; // APPROVED requires a financial row (enforced at approve time)
    const key = dateKey(entry.date);
    const cur = byDay.get(key) ?? { entriesCount: 0, gross: zero(), deduction: zero(), net: zero() };
    cur.entriesCount += 1;
    cur.gross = cur.gross.add(entry.financial.amount);
    cur.deduction = cur.deduction.add(entry.financial.companyDeduction).add(entry.financial.labourDeduction);
    cur.net = cur.net.add(entry.financial.netAmount);
    byDay.set(key, cur);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => {
      const present = presentMap.get(date) ?? null;
      const perPerson = present && present > 0 ? v.net.div(present).toDecimalPlaces(2) : null;
      return {
        date,
        entriesCount: v.entriesCount,
        grossAmount: v.gross,
        totalDeduction: v.deduction,
        netAmount: v.net,
        present,
        perPerson,
      };
    });
}

export interface RangeTotals {
  totalEntries: number;
  grossAmount: Prisma.Decimal;
  totalDeduction: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  totalLabourDays: number;
  averagePerPerson: Prisma.Decimal | null;
}

export function sumRows(rows: DayRow[]): RangeTotals {
  const totals = rows.reduce(
    (acc, r) => ({
      totalEntries: acc.totalEntries + r.entriesCount,
      grossAmount: acc.grossAmount.add(r.grossAmount),
      totalDeduction: acc.totalDeduction.add(r.totalDeduction),
      netAmount: acc.netAmount.add(r.netAmount),
      totalLabourDays: acc.totalLabourDays + (r.present ?? 0),
    }),
    { totalEntries: 0, grossAmount: zero(), totalDeduction: zero(), netAmount: zero(), totalLabourDays: 0 },
  );
  const averagePerPerson =
    totals.totalLabourDays > 0 ? totals.netAmount.div(totals.totalLabourDays).toDecimalPlaces(2) : null;
  return { ...totals, averagePerPerson };
}

export async function computeDailyReport(date: Date) {
  const rows = await computeDailyRows(date, date);
  return { date: dateKey(date), row: rows[0] ?? null };
}

export async function computeMonthlyReport(month: number, year: number) {
  const { from, to } = monthRange(month, year);
  const rows = await computeDailyRows(from, to);
  return { month, year, days: rows, totals: sumRows(rows) };
}

export interface MonthlyBillRow {
  date: string;
  vehicleNo: string;
  vehicleType: string;
  loadUnload: string;
  companyName: string;
  remark: string | null;
  amount: Prisma.Decimal;
}

export interface MonthlyBillTotals {
  subtotal: Prisma.Decimal;
  gstRatePct: number;
  gstAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

// GST rate on the itemized monthly bill. Reproduces the real April 2026
// bill exactly: subtotal 271450 -> GST 48861 -> total 320311, and
// 48861 / 271450 = 0.18 exactly, so 18% (not derived from any config —
// this is the flat rate the business has used on every bill, distinct
// from CalculationRule's company/labour deduction percentages, which are
// a completely separate concept applied per-entry before this bill is
// ever generated).
const BILL_GST_RATE_PCT = 18;

/**
 * Itemized entries across the WHOLE month (every company, not filtered to
 * one) — this is the "Bill" document (spec's second real PDF format):
 * SAGAR ROADWAYS AND ENTERPRISES billing their client for the month's
 * hamali work, one row per work entry, GST added on top, total spelled
 * out in words. Distinct from computeCompanyReport (which DOES filter to
 * one company) and computeMonthlyReport (which is day-level aggregates
 * for the internal per-day hamali summary, not itemized).
 */
export async function computeMonthlyBillRows(month: number, year: number): Promise<MonthlyBillRow[]> {
  const { from, to } = monthRange(month, year);

  const entries = await prisma.workEntry.findMany({
    where: { ...APPROVED, date: { gte: from, lte: to } },
    include: { financial: true, vehicleType: true, company: true },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  return entries
    .filter((e: { financial: unknown }) => e.financial)
    .map((e: (typeof entries)[number]) => ({
      date: dateKey(e.date),
      vehicleNo: e.vehicleNo,
      vehicleType: e.vehicleType.name,
      loadUnload: e.loadUnload,
      companyName: e.company.name,
      remark: e.remark,
      amount: e.financial!.amount,
    }));
}

export function computeMonthlyBillTotals(rows: MonthlyBillRow[]): MonthlyBillTotals {
  const subtotal = rows.reduce((acc, r) => acc.add(r.amount), zero());
  const gstAmount = subtotal.mul(BILL_GST_RATE_PCT).div(100).toDecimalPlaces(2);
  const grandTotal = subtotal.add(gstAmount);
  return { subtotal, gstRatePct: BILL_GST_RATE_PCT, gstAmount, grandTotal };
}

export interface CompanyReportRow {
  date: string;
  vehicleNo: string;
  vehicleType: string;
  loadUnload: string;
  amount: Prisma.Decimal;
  deduction: Prisma.Decimal;
  netAmount: Prisma.Decimal;
}

export async function computeCompanyReport(companyId: string, from: Date, to: Date) {
  const entries = await prisma.workEntry.findMany({
    where: { ...APPROVED, companyId, date: { gte: from, lte: to } },
    include: { financial: true, vehicleType: true, company: true },
    orderBy: { date: 'asc' },
  });

  const rows: CompanyReportRow[] = entries
    .filter((e: { financial: unknown }) => e.financial)
    .map((e: (typeof entries)[number]) => ({
      date: dateKey(e.date),
      vehicleNo: e.vehicleNo,
      vehicleType: e.vehicleType.name,
      loadUnload: e.loadUnload,
      amount: e.financial!.amount,
      deduction: e.financial!.companyDeduction.add(e.financial!.labourDeduction),
      netAmount: e.financial!.netAmount,
    }));

  const totals = rows.reduce(
    (acc, r) => ({
      amount: acc.amount.add(r.amount),
      deduction: acc.deduction.add(r.deduction),
      netAmount: acc.netAmount.add(r.netAmount),
    }),
    { amount: zero(), deduction: zero(), netAmount: zero() },
  );

  const companyName = entries[0]?.company.name ?? (await prisma.company.findUnique({ where: { id: companyId } }))?.name;

  return { companyId, companyName, from: dateKey(from), to: dateKey(to), rows, totals };
}

export interface LabourReportRow {
  date: string;
  entriesLogged: number;
  present: boolean;
  calculatedPayment: Prisma.Decimal;
}

/**
 * Labour's payment is their per-person SHARE of the day's total net amount
 * on days they were marked present — it is not tied to which specific
 * entries they personally logged (that's just "Work" / entriesLogged,
 * informational only, per spec section 17's columns: Date, Work,
 * Attendance, Calculated Payment).
 *
 * IMPORTANT — two different ids, not one:
 *   - `labourProfileId` is LabourProfile.id. DailyAttendance.labourId is a
 *     foreign key to THIS id.
 *   - `userId` is User.id (the same labourer's login account).
 *     WorkEntry.createdById is a foreign key to THIS id, not to
 *     LabourProfile.id.
 * They are different UUIDs (LabourProfile has its own generated `id`,
 * separate from its `userId` column). A previous version of this function
 * took a single `labourId` and used it for both queries — that silently
 * broke the "Work" (entriesLogged) column for every labourer, since a
 * WorkEntry.createdById lookup keyed on LabourProfile.id can never match a
 * real row. Taking both ids explicitly, by name, makes that mismatch
 * impossible to reintroduce by accident.
 */
export async function computeLabourReport(
  labourProfileId: string,
  userId: string,
  month: number,
  year: number,
) {
  const { from, to } = monthRange(month, year);

  const dayRows = await computeDailyRows(from, to);
  const perPersonByDate = new Map(dayRows.map((r) => [r.date, r.perPerson]));

  const [entryCounts, attendance] = await Promise.all([
    prisma.workEntry.groupBy({
      by: ['date'],
      where: { ...APPROVED, date: { gte: from, lte: to }, createdById: userId },
      _count: { _all: true },
    }),
    prisma.dailyAttendance.findMany({
      where: { labourId: labourProfileId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    }),
  ]);
  const entryCountMap = new Map(
    entryCounts.map((e: { date: Date; _count: { _all: number } }) => [dateKey(e.date), e._count._all]),
  );

  const rows: LabourReportRow[] = attendance.map((a: (typeof attendance)[number]) => {
    const key = dateKey(a.date);
    const perPerson = perPersonByDate.get(key) ?? null;
    return {
      date: key,
      entriesLogged: entryCountMap.get(key) ?? 0,
      present: a.present,
      calculatedPayment: a.present && perPerson ? perPerson : zero(),
    };
  });

  const totalPayment = rows.reduce((acc, r) => acc.add(r.calculatedPayment), zero());
  const daysPresent = rows.filter((r) => r.present).length;

  return { labourId: labourProfileId, month, year, rows, totals: { totalPayment, daysPresent } };
}
