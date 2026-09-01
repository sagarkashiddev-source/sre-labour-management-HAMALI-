import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { listUsers, createUser, disableUser } from '../controllers/user.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Every route: authenticate, THEN authorize by role. User management is
// Admin-only per the permission matrix (spec section 47) — Owner never
// gets this even with permission flags.
router.use(requireAuth, requireRole('ADMIN'));

router.get('/', asyncHandler(listUsers));
router.post('/', asyncHandler(createUser));
router.patch('/:id/disable', asyncHandler(disableUser));

export default router;
