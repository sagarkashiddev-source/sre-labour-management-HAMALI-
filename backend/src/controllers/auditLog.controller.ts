import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { getOwnerPermission } from '../services/permission.service';
import { prisma } from '../lib/prisma';

const listQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// Entity types an Owner's "Limited" audit access (spec section 47:
// "Audit Logs: Admin ✅, Owner Limited, Labour ❌") may ever see — operational
// and financial history only. User/Company/System/VehicleType changes are
// Admin-only, since those aren't Owner's business to review.
const OWNER_VISIBLE_ENTITY_TYPES = ['WorkEntry', 'EntryFinancial'];

export async function listAuditLogs(req: Request, res: Response) {
  const q = listQuerySchema.parse(req.query);
  const { userId, role } = req.user!;

  let entityTypeFilter: Prisma.AuditLogWhereInput['entityType'] = q.entityType;

  if (role === 'OWNER') {
    const perm = await getOwnerPermission(userId);
    if (!perm?.canViewAuditLogsLimited) {
      throw new AppError(403, 'You do not have permission to view audit logs.');
    }
    // Owner can narrow within their allowed set via ?entityType=, but can
    // never widen past it — even if they pass entityType=User explicitly.
    if (q.entityType && !OWNER_VISIBLE_ENTITY_TYPES.includes(q.entityType)) {
      throw new AppError(403, 'You do not have permission to view that type of audit log.');
    }
    entityTypeFilter = q.entityType ?? { in: OWNER_VISIBLE_ENTITY_TYPES };
  }

  const where: Prisma.AuditLogWhereInput = {
    ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.action ? { action: q.action } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Extra redaction layer: even within EntryFinancial history, an Owner
  // without canViewFinancials shouldn't see the actual amounts, only that
  // *something* financial changed. (An Owner reaches this branch only if
  // canViewAuditLogsLimited is true but canViewFinancials is false — a
  // legitimate configuration per spec's "permissions in addition to role"
  // requirement in section 3.)
  let redactFinancialValues = false;
  if (role === 'OWNER') {
    const perm = await getOwnerPermission(userId);
    redactFinancialValues = !perm?.canViewFinancials;
  }

  const shaped = logs.map((log: (typeof logs)[number]) => {
    if (redactFinancialValues && log.entityType === 'EntryFinancial') {
      return { ...log, oldValue: null, newValue: { note: 'Financial details hidden.' } };
    }
    return log;
  });

  return res.json({ logs: shaped, total, page: q.page, pageSize: q.pageSize });
}

const entityHistoryParamsSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
});

/**
 * GET /api/audit-logs/history/:entityType/:entityId — convenience endpoint
 * for the "View Audit History" action on a single entry (spec section 12
 * example: full change timeline for Entry #1024). Same access rules as
 * listAuditLogs.
 */
export async function getEntityHistory(req: Request, res: Response) {
  const { entityType, entityId } = entityHistoryParamsSchema.parse(req.params);
  const { userId, role } = req.user!;

  // Same redaction rule as listAuditLogs, and for the same reason: an Owner
  // can legitimately have canViewAuditLogsLimited=true while
  // canViewFinancials=false (spec's "permissions in addition to role").
  // This endpoint used to skip that redaction entirely — a direct
  // GET /api/audit-logs/history/EntryFinancial/:id call returned full
  // amount/oldValue/newValue regardless of canViewFinancials, leaking
  // exactly the data listAuditLogs was careful to hide. Applying the same
  // check here closes that gap rather than relying on the other endpoint
  // to be the only door in.
  let redactFinancialValues = false;

  if (role === 'OWNER') {
    const perm = await getOwnerPermission(userId);
    if (!perm?.canViewAuditLogsLimited) {
      throw new AppError(403, 'You do not have permission to view audit logs.');
    }
    if (!OWNER_VISIBLE_ENTITY_TYPES.includes(entityType)) {
      throw new AppError(403, 'You do not have permission to view that type of audit log.');
    }
    redactFinancialValues = !perm?.canViewFinancials;
  }

  const logs = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const shaped = logs.map((log: (typeof logs)[number]) => {
    if (redactFinancialValues && log.entityType === 'EntryFinancial') {
      return { ...log, oldValue: null, newValue: { note: 'Financial details hidden.' } };
    }
    return log;
  });

  return res.json({ entityType, entityId, logs: shaped });
}
