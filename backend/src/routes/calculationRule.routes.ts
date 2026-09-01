import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listCalculationRules,
  createCalculationRule,
  getActiveRule,
} from '../controllers/calculationRule.controller';

const router = Router();

// Flat Admin-only, no Owner exception — spec section 47: "Calculation
// Settings: Admin ✅, Owner ❌, Labour ❌." Unlike Companies or entry
// cancellation, this is never Owner-configurable.
router.use(requireAuth, requireRole('ADMIN'));

router.get('/', asyncHandler(listCalculationRules));
router.get('/active', asyncHandler(getActiveRule));
router.post('/', asyncHandler(createCalculationRule));

export default router;
