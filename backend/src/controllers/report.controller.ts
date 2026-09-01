import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { getOwnerPermission } from '../services/permission.service';
import {
  computeDailyReport,
  computeMonthlyReport,
  computeCompanyReport,
  computeLabourReport,
} from '../services/report.service';
import { generateMonthlyExcel, generateMonthlyPdf } from '../services/export.service';

const prisma = new PrismaClient();

// -----------------------------------------------------------------------
// Permission gates — mirrors spec section 47's matrix exactly: Admin
// always allowed; Owner only with the specific flag; Labour never (routes
// already block Labour at requireRole, this is the Owner fine-grained bit).
// -----------------------------------------------------------------------

async function assertCanViewFinancialReports(userId: string, role: 'ADMIN' | 'OWNER') {
  if (role === 'ADMIN') return;
  const perm = await getOwnerPermission(userId);
  if (!perm?.canViewFinancialReports) {
    throw new AppError(403, 'You do not have permission to view financial reports.');
  }
}

async function assertCanExport(userId: string, role: 'ADMIN' | 'OWNER', kind: 'excel' | 'pdf') {
  if (role === 'ADMIN') return;
  const perm = await getOwnerPermission(userId);
  const allowed = kind === 'excel' ? perm?.canExportExcel : perm?.canExportPdf;
  if (!allowed) {
    throw new AppError(403, `You do not have permission to export ${kind === 'excel' ? 'Excel' : 'PDF'} reports.`);
  }
}

// -----------------------------------------------------------------------
// Daily
// -----------------------------------------------------------------------

const dateSchema = z.object({ date: z.coerce.date({ errorMap: () => ({ message: 'A valid date is required.' }) }) });

export async function getDailyReport(req: Request, res: Response) {
  const { userId, role } = req.user!;
  await assertCanViewFinancialReports(userId, role as 'ADMIN' | 'OWNER');
  const { date } = dateSchema.parse(req.query);
  const report = await computeDailyReport(date);
  return res.json(report);
}

// -----------------------------------------------------------------------
// Monthly
// -----------------------------------------------------------------------

const monthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12, 'Month must be between 1 and 12.'),
  year: z.coerce.number().int().min(2020).max(2100, 'Please provide a valid year.'),
});

export async function getMonthlyReport(req: Request, res: Response) {
  const { userId, role } = req.user!;
  await assertCanViewFinancialReports(userId, role as 'ADMIN' | 'OWNER');
  const { month, year } = monthYearSchema.parse(req.query);
  const report = await computeMonthlyReport(month, year);
  return res.json(report);
}

export async function exportMonthlyExcel(req: Request, res: Response) {
  const { userId, role } = req.user!;
  await assertCanExport(userId, role as 'ADMIN' | 'OWNER', 'excel');
  const { month, year } = monthYearSchema.parse(req.query);
  const { days, totals } = await computeMonthlyReport(month, year);

  const buffer = await generateMonthlyExcel(month, year, days, totals);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="SRE_Report_${month}_${year}.xlsx"`);
  return res.send(Buffer.from(buffer));
}

export async function exportMonthlyPdf(req: Request, res: Response) {
  const { userId, role } = req.user!;
  await assertCanExport(userId, role as 'ADMIN' | 'OWNER', 'pdf');
  const { month, year } = monthYearSchema.parse(req.query);
  const { days, totals } = await computeMonthlyReport(month, year);

  const buffer = await generateMonthlyPdf(month, year, days, totals);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="SRE_Report_${month}_${year}.pdf"`);
  return res.send(buffer);
}

// -----------------------------------------------------------------------
// Company
// -----------------------------------------------------------------------

const companyReportSchema = z.object({
  companyId: z.string().uuid('Please select a company.'),
  from: z.coerce.date({ errorMap: () => ({ message: 'A valid from-date is required.' }) }),
  to: z.coerce.date({ errorMap: () => ({ message: 'A valid to-date is required.' }) }),
});

export async function getCompanyReport(req: Request, res: Response) {
  const { userId, role } = req.user!;
  await assertCanViewFinancialReports(userId, role as 'ADMIN' | 'OWNER');
  const { companyId, from, to } = companyReportSchema.parse(req.query);
  if (from > to) throw new AppError(400, 'From date must be before the to date.');

  const report = await computeCompanyReport(companyId, from, to);
  return res.json(report);
}

// -----------------------------------------------------------------------
// Labour
// -----------------------------------------------------------------------

const labourReportSchema = monthYearSchema.extend({
  labourId: z.string().uuid('Please select a labourer.'),
});

/**
 * Admin/Owner only, per spec section 17: "Labour users themselves should
 * NOT automatically get access to this financial report unless Admin
 * explicitly enables it" — that self-service toggle is a future Settings
 * feature, not implemented here, so for now this route simply isn't
 * reachable by LABOUR at all (blocked at the route's requireRole).
 */
export async function getLabourReport(req: Request, res: Response) {
  const { userId, role } = req.user!;
  await assertCanViewFinancialReports(userId, role as 'ADMIN' | 'OWNER');
  const { labourId, month, year } = labourReportSchema.parse(req.query);

  const labour = await prisma.labourProfile.findUnique({ where: { id: labourId } });
  if (!labour) throw new AppError(404, 'Labourer not found.');

  const report = await computeLabourReport(labourId, month, year);
  return res.json(report);
}
