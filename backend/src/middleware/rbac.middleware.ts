import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

/**
 * Route-level role gate. Use on every route.
 *
 *   router.get('/users', requireAuth, requireRole('ADMIN'), listUsers)
 *
 * This blocks the whole route for the wrong role. It is NOT sufficient by
 * itself for entries/financials, because ADMIN and OWNER share routes but
 * see different fields — see FINANCIAL_SELECT / OPERATIONAL_SELECT below,
 * which must be applied in every controller that touches WorkEntry.
 */
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }
    next();
  };
}

/**
 * Prisma `select` shape returned for LABOUR (and any unauthorized OWNER).
 * No `financial` relation — financial data never leaves the database for
 * these requests, it is not merely omitted from the JSON after the fact.
 */
export const OPERATIONAL_ENTRY_SELECT = {
  id: true,
  date: true,
  vehicleNo: true,
  vehicleType: { select: { id: true, name: true } },
  loadUnload: true,
  company: { select: { id: true, name: true } },
  remark: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Prisma `select` shape returned for ADMIN, or OWNER with
 * ownerPermission.canViewFinancials === true.
 */
export const FINANCIAL_ENTRY_SELECT = {
  ...OPERATIONAL_ENTRY_SELECT,
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  approvedAt: true,
  financial: {
    select: {
      amount: true,
      companyDeductionPct: true,
      companyDeduction: true,
      balanceAfterCompany: true,
      labourDeductionPct: true,
      labourDeduction: true,
      netAmount: true,
    },
  },
} as const;

/**
 * Decide which select shape to use for the current requester. Call this in
 * every entries controller rather than branching ad hoc, so the rule lives
 * in one place.
 */
export async function entrySelectFor(
  role: Role,
  ownerCanViewFinancials: boolean | null | undefined,
) {
  if (role === 'ADMIN') return FINANCIAL_ENTRY_SELECT;
  if (role === 'OWNER' && ownerCanViewFinancials) return FINANCIAL_ENTRY_SELECT;
  return OPERATIONAL_ENTRY_SELECT; // LABOUR, or OWNER without the grant
}
