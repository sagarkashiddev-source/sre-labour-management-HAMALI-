import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listEntries,
  getEntry,
  createEntry,
  updateEntry,
  cancelEntry,
  approveEntry,
  reopenEntry,
} from '../controllers/entry.controller';
import { upsertFinancial, previewFinancial } from '../controllers/financial.controller';

const router = Router();

// All entry routes require login. Role- and ownership-level checks (Labour
// scoped to their own entries, Owner's permission flags) happen inside the
// controllers, since ADMIN/OWNER/LABOUR all share these same routes but see
// and can do different things with them — a single requireRole() here
// would be too coarse.
router.use(requireAuth);

router.get('/', asyncHandler(listEntries));
router.get('/:id', asyncHandler(getEntry));
router.post('/', asyncHandler(createEntry));
router.patch('/:id', asyncHandler(updateEntry));

// Cancel and approve are never available to Labour at all — route-level
// gate here, in addition to the Owner permission check inside the
// controller for the ADMIN vs. "configurable Owner" split.
router.patch('/:id/cancel', requireRole('ADMIN', 'OWNER'), asyncHandler(cancelEntry));
router.patch('/:id/approve', requireRole('ADMIN', 'OWNER'), asyncHandler(approveEntry));

// Reopening an approved entry for correction is ADMIN-only, full stop — not
// even an Owner granted every other financial permission can do this. See
// reopenEntry() for why (locking approved entries is the whole point).
router.patch('/:id/reopen', requireRole('ADMIN'), asyncHandler(reopenEntry));

// Financials: never reachable by LABOUR, enforced at the route level (not
// just inside the controller) since this is the single hardest boundary
// in the whole system.
router.post('/:id/financials', requireRole('ADMIN', 'OWNER'), asyncHandler(upsertFinancial));
router.get('/:id/financials/preview', requireRole('ADMIN', 'OWNER'), asyncHandler(previewFinancial));

export default router;
