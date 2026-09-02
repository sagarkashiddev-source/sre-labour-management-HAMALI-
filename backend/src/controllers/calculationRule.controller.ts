import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { getActiveRuleForDate } from '../services/calculation.service';
import { prisma } from '../lib/prisma';

/**
 * Calculation Rules are deliberately APPEND-ONLY — there is no update or
 * delete here, only "add a new rule effective from date X". This is a
 * conscious design choice, not a missing feature:
 *
 * Every entry_financials row snapshots the percentages that were active
 * when it was calculated (see financial.controller.ts). If we let Admin
 * edit an existing CalculationRule in place, that snapshot guarantee would
 * still hold for past entries — but it would become impossible to answer
 * "what rule was in effect on 15 June?" from the rules table alone, since
 * the row would now say whatever it was last edited to. Editing history
 * in place is exactly the Excel failure mode (section 40/14) this system
 * is replacing. A correction is made by adding a new rule with the
 * corrected percentages and an effectiveFrom date, same as the real
 * business already did three times in the source workbook.
 */

export async function listCalculationRules(_req: Request, res: Response) {
  const rules = await prisma.calculationRule.findMany({
    orderBy: { effectiveFrom: 'desc' },
  });
  return res.json({ rules });
}

const createRuleSchema = z.object({
  effectiveFrom: z.coerce.date({ errorMap: () => ({ message: 'A valid effective-from date is required.' }) }),
  companyDeductionPct: z.coerce.number().min(0).max(100, 'Percentage must be between 0 and 100.'),
  labourDeductionPct: z.coerce.number().min(0).max(100, 'Percentage must be between 0 and 100.'),
  // NOTE: an `otherDeductionPct` field previously existed on this schema and
  // API but was never wired into calculation.service.ts, never surfaced in
  // the Admin Settings UI, and never applied to any entry — a rule saved
  // with a non-zero value would silently do nothing, which is worse than
  // not having the field at all. Removed rather than left half-built; if a
  // genuine third deduction category is needed later, it should be added
  // end-to-end (schema + calculation.service + EntryFinancial snapshot +
  // Settings UI + reports) in one pass, not reintroduced as a dead field.
  note: z.string().max(500).optional(),
});

export async function createCalculationRule(req: Request, res: Response) {
  const data = createRuleSchema.parse(req.body);

  const existing = await prisma.calculationRule.findFirst({
    where: { effectiveFrom: data.effectiveFrom },
  });
  if (existing) {
    throw new AppError(400, 'A calculation rule already starts on this exact date. Choose a different date.');
  }

  const rule = await prisma.$transaction(async (tx) => {
    const r = await tx.calculationRule.create({ data });
    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CALCULATION_RULE_CREATED',
        entityType: 'CalculationRule',
        entityId: r.id,
        // data.effectiveFrom is a Date — same JSON-field typing note as
        // entry.controller.ts's equivalent casts.
        newValue: data as Prisma.InputJsonValue,
        ipAddress: req.ip,
      },
    });
    return r;
  });

  return res.status(201).json({ rule });
}

const previewDateSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: 'A valid date is required.' }) }),
});

/**
 * GET /api/calculation-rules/active?date=2026-08-20 — lets Admin's
 * Settings screen show "this is the rule that will apply" before entries
 * for a given date are even created.
 */
export async function getActiveRule(req: Request, res: Response) {
  const { date } = previewDateSchema.parse(req.query);
  try {
    const rule = await getActiveRuleForDate(date);
    return res.json({ rule });
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'No calculation rule found for that date.');
  }
}
