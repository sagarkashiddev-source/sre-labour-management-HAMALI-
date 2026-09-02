import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getDailyReport,
  getMonthlyReport,
  exportMonthlyExcel,
  exportMonthlyPdf,
  getMonthlyBill,
  exportMonthlyBillExcel,
  exportMonthlyBillPdf,
  getCompanyReport,
  getLabourReport,
} from '../controllers/report.controller';

const router = Router();

// Route-level: Labour never reaches any report route at all, matching the
// permission matrix's flat "Financial Reports: ❌" for Labour. Owner's
// finer-grained flags (canViewFinancialReports / canExportExcel /
// canExportPdf) are then checked inside each controller.
router.use(requireAuth, requireRole('ADMIN', 'OWNER'));

router.get('/daily', asyncHandler(getDailyReport));
router.get('/monthly', asyncHandler(getMonthlyReport));
router.get('/monthly/export/excel', asyncHandler(exportMonthlyExcel));
router.get('/monthly/export/pdf', asyncHandler(exportMonthlyPdf));
router.get('/monthly-bill', asyncHandler(getMonthlyBill));
router.get('/monthly-bill/export/excel', asyncHandler(exportMonthlyBillExcel));
router.get('/monthly-bill/export/pdf', asyncHandler(exportMonthlyBillPdf));
router.get('/company', asyncHandler(getCompanyReport));
router.get('/labour', asyncHandler(getLabourReport));

export default router;
