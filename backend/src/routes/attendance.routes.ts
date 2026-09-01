import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { setDayAttendance, getDayAttendance } from '../controllers/attendance.controller';

const router = Router();

// Admin-only: attendance directly drives the per-person financial
// calculation, so it gets the same trust level as amounts, not the looser
// "Owner configurable" treatment other operational data gets.
router.use(requireAuth, requireRole('ADMIN'));

router.get('/day', asyncHandler(getDayAttendance));
router.post('/day', asyncHandler(setDayAttendance));

export default router;
