import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listVehicleTypes,
  createVehicleType,
  disableVehicleType,
} from '../controllers/vehicleType.controller';

const router = Router();

router.use(requireAuth);

// GET is open to all roles (every entry form needs the Type dropdown).
router.get('/', asyncHandler(listVehicleTypes));

// Mutation is Admin-only — flat role gate, unlike Companies this is not
// Owner-configurable per spec section 28.
router.post('/', requireRole('ADMIN'), asyncHandler(createVehicleType));
router.patch('/:id/disable', requireRole('ADMIN'), asyncHandler(disableVehicleType));

export default router;
