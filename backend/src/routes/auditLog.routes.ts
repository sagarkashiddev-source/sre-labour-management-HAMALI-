import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { listAuditLogs, getEntityHistory } from '../controllers/auditLog.controller';

const router = Router();

// LABOUR is blocked entirely at the route level (flat ❌ in the permission
// matrix). Admin vs. Owner's "Limited" scope is resolved inside the
// controller, since it depends on the per-user canViewAuditLogsLimited /
// canViewFinancials flags, not just the role.
router.use(requireAuth, requireRole('ADMIN', 'OWNER'));

router.get('/', asyncHandler(listAuditLogs));
router.get('/history/:entityType/:entityId', asyncHandler(getEntityHistory));

export default router;
