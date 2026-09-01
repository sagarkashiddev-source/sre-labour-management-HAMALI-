import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { listCompanies, createCompany, updateCompany, disableCompany } from '../controllers/company.controller';

const router = Router();

router.use(requireAuth);

// GET is open to all roles (Labour needs it for the entry form dropdown).
// Mutation permission (Admin, or Owner with canManageCompanies) is checked
// inside the controller since Owner access is configurable per-user, not a
// flat role gate.
router.get('/', asyncHandler(listCompanies));
router.post('/', asyncHandler(createCompany));
router.patch('/:id', asyncHandler(updateCompany));
router.patch('/:id/disable', asyncHandler(disableCompany));

export default router;
