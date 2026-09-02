import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { getOwnerPermission } from '../services/permission.service';
import { calculateEntryFinancials, getActiveRuleForDate } from '../services/calculation.service';
import { prisma } from '../lib/prisma';

const amountSchema = z.object({
  amount: z.coerce
    .number({ errorMap: () => ({ message: 'Amount is required.' }) })
    .nonnegative('Amount cannot be negative.'),
  // Optional overrides for a one-off "Other Deduction" beyond the standard
  // rule (spec section 18's "Other Deduction" field). Defaults to the
  // active CalculationRule's percentages when omitted.
  companyDeductionPctOverride: z.coerce.number().min(0).max(100).optional(),
  labourDeductionPctOverride: z.coerce.number().min(0).max(100).optional(),
});

async function assertCanEditAmount(userId: string, role: 'ADMIN' | 'OWNER' | 'LABOUR') {
  if (role === 'ADMIN') return;
  if (role === 'OWNER') {
    const perm = await getOwnerPermission(userId);
    if (!perm?.canEditAmount) {
      throw new AppError(403, 'You do not have permission to enter amounts.');
    }
    return;
  }
  throw new AppError(403, 'You do not have permission to enter amounts.');
}

/**
 * POST /api/entries/:id/financials
 * Creates or updates the EntryFinancial row for an entry, computing the
 * two-stage deduction via calculation.service (the same logic verified
 * against the workbook). Does NOT approve the entry — approval is a
 * separate explicit action (approveEntry).
 */
export async function upsertFinancial(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, role } = req.user!;
  await assertCanEditAmount(userId, role);

  const body = amountSchema.parse(req.body);

  const entry = await prisma.workEntry.findUnique({ where: { id }, include: { financial: true } });
  if (!entry) throw new AppError(404, 'Entry not found.');
  if (entry.status === 'CANCELLED') {
    throw new AppError(400, 'Cannot set an amount on a cancelled entry.');
  }
  // Approved entries are locked, same as their operational fields (see
  // entry.controller.ts updateEntry) — the amount is exactly the field a
  // silent post-approval edit would matter most for. Admin must explicitly
  // reopen the entry (POST /entries/:id/reopen) before the amount can change.
  if (entry.status === 'APPROVED') {
    throw new AppError(
      403,
      'This entry is approved and locked. Ask an Admin to reopen it for correction before changing the amount.',
    );
  }

  const rule = await getActiveRuleForDate(entry.date);
  const companyPct = body.companyDeductionPctOverride ?? Number(rule.companyDeductionPct);
  const labourPct = body.labourDeductionPctOverride ?? Number(rule.labourDeductionPct);

  const calc = calculateEntryFinancials(body.amount, companyPct, labourPct);

  const oldAmount = entry.financial?.amount ?? null;

  const financial = await prisma.$transaction(async (tx) => {
    const f = await tx.entryFinancial.upsert({
      where: { workEntryId: id },
      create: {
        workEntryId: id,
        amount: calc.amount,
        companyDeductionPct: calc.companyDeductionPct,
        companyDeduction: calc.companyDeduction,
        balanceAfterCompany: calc.balanceAfterCompany,
        labourDeductionPct: calc.labourDeductionPct,
        labourDeduction: calc.labourDeduction,
        netAmount: calc.netAmount,
        createdById: userId,
      },
      update: {
        amount: calc.amount,
        companyDeductionPct: calc.companyDeductionPct,
        companyDeduction: calc.companyDeduction,
        balanceAfterCompany: calc.balanceAfterCompany,
        labourDeductionPct: calc.labourDeductionPct,
        labourDeduction: calc.labourDeduction,
        netAmount: calc.netAmount,
        updatedById: userId,
      },
    });

    // Atomic with the write above — this is THE most important audit trail
    // in the whole system (it's literally what the money says), so it gets
    // the same "commit together or not at all" guarantee as every other
    // critical update.
    await tx.auditLog.create({
      data: {
        userId,
        action: oldAmount === null ? 'AMOUNT_SET' : 'AMOUNT_CHANGED',
        entityType: 'EntryFinancial',
        entityId: id,
        oldValue: oldAmount === null ? null : { amount: oldAmount.toString() },
        newValue: { amount: calc.amount.toString(), netAmount: calc.netAmount.toString() },
        ipAddress: req.ip,
      },
    });

    return f;
  });

  return res.json({
    financial: {
      amount: financial.amount,
      companyDeductionPct: financial.companyDeductionPct,
      companyDeduction: financial.companyDeduction,
      balanceAfterCompany: financial.balanceAfterCompany,
      labourDeductionPct: financial.labourDeductionPct,
      labourDeduction: financial.labourDeduction,
      netAmount: financial.netAmount,
    },
  });
}

/**
 * GET /api/entries/:id/financials/preview?amount=5000
 * Live calculation preview (spec section 19's "Calculation Preview" card)
 * WITHOUT saving anything — lets the Admin UI show the cascade as the user
 * types, before committing.
 */
const previewQuerySchema = z.object({
  amount: z.coerce.number().nonnegative('Amount cannot be negative.'),
});

export async function previewFinancial(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, role } = req.user!;
  await assertCanEditAmount(userId, role);

  const { amount } = previewQuerySchema.parse(req.query);

  const entry = await prisma.workEntry.findUnique({ where: { id }, select: { date: true } });
  if (!entry) throw new AppError(404, 'Entry not found.');

  const rule = await getActiveRuleForDate(entry.date);
  const calc = calculateEntryFinancials(
    amount,
    Number(rule.companyDeductionPct),
    Number(rule.labourDeductionPct),
  );

  return res.json({ preview: calc, rule: { companyDeductionPct: rule.companyDeductionPct, labourDeductionPct: rule.labourDeductionPct } });
}
