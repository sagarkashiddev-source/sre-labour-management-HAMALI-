import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { entrySelectFor } from '../middleware/rbac.middleware';
import { getOwnerPermission } from '../services/permission.service';
import { normalizeVehicleNo, isPlausibleVehicleNo } from '../utils/normalize';

const prisma = new PrismaClient();

// -----------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------

// Fields every role may create/edit. This is intentionally the ONLY set of
// fields a LABOUR request is allowed to touch — enforced below, not just by
// which fields happen to be in this schema.
const operationalFieldsSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: 'A valid date is required.' }) }),
  vehicleNo: z.string().min(3, 'Vehicle number is required.'),
  vehicleTypeId: z.string().uuid('Please select a vehicle type.'),
  loadUnload: z.enum(['LOAD', 'UNLOAD'], {
    errorMap: () => ({ message: 'Please select Load or Unload.' }),
  }),
  companyId: z.string().uuid('Please select a company.'),
  remark: z.string().max(500).optional(),
});

const createEntrySchema = operationalFieldsSchema.extend({
  force: z.boolean().optional(), // override duplicate warning
});

const updateEntrySchema = operationalFieldsSchema.partial();

// -----------------------------------------------------------------------
// List / Get
// -----------------------------------------------------------------------

const listQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  companyId: z.string().uuid().optional(),
  vehicleNo: z.string().optional(),
  vehicleTypeId: z.string().uuid().optional(),
  loadUnload: z.enum(['LOAD', 'UNLOAD']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'CANCELLED']).optional(),
  createdById: z.string().uuid().optional(),
  search: z.string().optional(), // matches vehicle number
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function listEntries(req: Request, res: Response) {
  const q = listQuerySchema.parse(req.query);
  const { userId, role } = req.user!;

  const ownerPerm = role === 'OWNER' ? await getOwnerPermission(userId) : null;
  const select = await entrySelectFor(role, ownerPerm?.canViewFinancials);

  // Vehicle filter and general search must COMBINE, never overwrite one
  // another — this was a real bug: both previously wrote to the same
  // `vehicleNo` object key, so passing both silently dropped the vehicle
  // filter. Built as an explicit AND array instead, and `search` now also
  // matches company name / remark (spec section 35), not just vehicle no.
  const combinedFilters: Prisma.WorkEntryWhereInput[] = [];
  if (q.vehicleNo) {
    combinedFilters.push({ vehicleNo: { contains: normalizeVehicleNo(q.vehicleNo) } });
  }
  if (q.search) {
    const term = normalizeVehicleNo(q.search);
    combinedFilters.push({
      OR: [
        { vehicleNo: { contains: term } },
        { company: { name: { contains: q.search, mode: 'insensitive' } } },
        { remark: { contains: q.search, mode: 'insensitive' } },
        { id: { contains: q.search } },
      ],
    });
  }

  const where: Prisma.WorkEntryWhereInput = {
    ...(q.from || q.to
      ? { date: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
      : {}),
    ...(q.companyId ? { companyId: q.companyId } : {}),
    ...(q.vehicleTypeId ? { vehicleTypeId: q.vehicleTypeId } : {}),
    ...(q.loadUnload ? { loadUnload: q.loadUnload } : {}),
    ...(q.createdById ? { createdById: q.createdById } : {}),
    ...(combinedFilters.length > 0 ? { AND: combinedFilters } : {}),
    // Default: hide CANCELLED unless explicitly requested (spec section 21).
    status: q.status ?? { not: 'CANCELLED' },
    // LABOUR only ever sees their own entries, regardless of query params.
    ...(role === 'LABOUR' ? { createdById: userId } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.workEntry.findMany({
      where,
      select,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.workEntry.count({ where }),
  ]);

  return res.json({ entries, total, page: q.page, pageSize: q.pageSize });
}

export async function getEntry(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, role } = req.user!;

  if (role === 'LABOUR') {
    const owner = await prisma.workEntry.findUnique({ where: { id }, select: { createdById: true } });
    if (!owner) throw new AppError(404, 'Entry not found.');
    if (owner.createdById !== userId) {
      throw new AppError(403, 'You can only view your own entries.');
    }
  }

  const ownerPerm = role === 'OWNER' ? await getOwnerPermission(userId) : null;
  const select = await entrySelectFor(role, ownerPerm?.canViewFinancials);

  const entry = await prisma.workEntry.findUnique({ where: { id }, select });
  if (!entry) {
    throw new AppError(404, 'Entry not found.');
  }

  return res.json({ entry });
}

// -----------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------

async function findDuplicate(
  date: Date,
  vehicleNo: string,
  companyId: string,
  loadUnload: 'LOAD' | 'UNLOAD',
) {
  return prisma.workEntry.findFirst({
    where: {
      date,
      vehicleNo,
      companyId,
      loadUnload,
      status: { not: 'CANCELLED' },
    },
    select: { id: true, createdAt: true },
  });
}

export async function createEntry(req: Request, res: Response) {
  const { userId } = req.user!;
  const body = createEntrySchema.parse(req.body);
  const vehicleNo = normalizeVehicleNo(body.vehicleNo);

  if (!isPlausibleVehicleNo(vehicleNo)) {
    throw new AppError(400, "That doesn't look like a valid vehicle number. Please check and try again.");
  }

  const company = await prisma.company.findUnique({ where: { id: body.companyId } });
  if (!company || company.status !== 'ACTIVE') {
    throw new AppError(400, 'Please select a valid company.');
  }
  const vehicleType = await prisma.vehicleType.findUnique({ where: { id: body.vehicleTypeId } });
  if (!vehicleType || vehicleType.status !== 'ACTIVE') {
    throw new AppError(400, 'Please select a valid type.');
  }

  const duplicate = await findDuplicate(body.date, vehicleNo, body.companyId, body.loadUnload);
  if (duplicate && !body.force) {
    return res.status(409).json({
      warning: 'A similar entry already exists. Are you sure you want to continue?',
      duplicateEntryId: duplicate.id,
    });
  }

  let entry;
  try {
    entry = await prisma.workEntry.create({
      data: {
        date: body.date,
        vehicleNo,
        vehicleTypeId: body.vehicleTypeId,
        loadUnload: body.loadUnload,
        companyId: body.companyId,
        remark: body.remark,
        createdById: userId,
        status: 'PENDING',
      },
    });
  } catch (err) {
    // Race condition: two near-simultaneous requests both passed the
    // findDuplicate() check above before either committed. The database's
    // partial unique index (see prisma/migrations/20260821_add_duplicate_entry_guard)
    // is the actual source of truth here — this converts that constraint
    // violation into the same friendly warning instead of a raw 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raceDuplicate = await findDuplicate(body.date, vehicleNo, body.companyId, body.loadUnload);
      return res.status(409).json({
        warning: 'A similar entry already exists. Are you sure you want to continue?',
        duplicateEntryId: raceDuplicate?.id,
      });
    }
    throw err;
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'ENTRY_CREATED',
      entityType: 'WorkEntry',
      entityId: entry.id,
      newValue: { vehicleNo, date: body.date, companyId: body.companyId, loadUnload: body.loadUnload },
      ipAddress: req.ip,
    },
  });

  return res.status(201).json({ entry: { id: entry.id, status: entry.status } });
}

// -----------------------------------------------------------------------
// Update (operational fields only — amount goes through financial.controller)
// -----------------------------------------------------------------------

export async function updateEntry(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, role } = req.user!;
  const body = updateEntrySchema.parse(req.body);

  const existing = await prisma.workEntry.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Entry not found.');
  }

  if (role === 'LABOUR') {
    if (existing.createdById !== userId) {
      throw new AppError(403, 'You can only edit your own entries.');
    }
    if (existing.status !== 'PENDING') {
      throw new AppError(
        403,
        'This entry has already been processed and can no longer be edited. Contact Admin for a correction.',
      );
    }
    // Labour is restricted to operationalFieldsSchema by the schema itself —
    // no amount/financial field exists on this schema to smuggle through.
  }

  const updateData: Prisma.WorkEntryUpdateInput = { updatedBy: { connect: { id: userId } } };
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (body.date && body.date.getTime() !== existing.date.getTime()) {
    changes.date = { old: existing.date, new: body.date };
    updateData.date = body.date;
  }
  if (body.vehicleNo) {
    const normalized = normalizeVehicleNo(body.vehicleNo);
    if (normalized !== existing.vehicleNo) {
      changes.vehicleNo = { old: existing.vehicleNo, new: normalized };
      updateData.vehicleNo = normalized;
    }
  }
  if (body.vehicleTypeId && body.vehicleTypeId !== existing.vehicleTypeId) {
    changes.vehicleTypeId = { old: existing.vehicleTypeId, new: body.vehicleTypeId };
    updateData.vehicleType = { connect: { id: body.vehicleTypeId } };
  }
  if (body.loadUnload && body.loadUnload !== existing.loadUnload) {
    changes.loadUnload = { old: existing.loadUnload, new: body.loadUnload };
    updateData.loadUnload = body.loadUnload;
  }
  if (body.companyId && body.companyId !== existing.companyId) {
    changes.companyId = { old: existing.companyId, new: body.companyId };
    updateData.company = { connect: { id: body.companyId } };
  }
  if (body.remark !== undefined && body.remark !== existing.remark) {
    changes.remark = { old: existing.remark, new: body.remark };
    updateData.remark = body.remark;
  }

  if (Object.keys(changes).length === 0) {
    return res.json({ entry: existing, message: 'No changes to save.' });
  }

  const updated = await prisma.workEntry.update({ where: { id }, data: updateData });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'ENTRY_UPDATED',
      entityType: 'WorkEntry',
      entityId: id,
      oldValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
      newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
      ipAddress: req.ip,
    },
  });

  return res.json({ entry: { id: updated.id, status: updated.status } });
}

// -----------------------------------------------------------------------
// Cancel (soft — never deletes, per spec section 21)
// -----------------------------------------------------------------------

const cancelSchema = z.object({ reason: z.string().max(500).optional() });

export async function cancelEntry(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, role } = req.user!;
  const { reason } = cancelSchema.parse(req.body ?? {});

  if (role === 'OWNER') {
    const perm = await getOwnerPermission(userId);
    if (!perm?.canCancelEntries) {
      throw new AppError(403, 'You do not have permission to cancel entries.');
    }
  }
  // LABOUR is blocked entirely by the route-level requireRole('ADMIN','OWNER').

  const existing = await prisma.workEntry.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Entry not found.');
  if (existing.status === 'CANCELLED') {
    throw new AppError(400, 'This entry is already cancelled.');
  }

  const updated = await prisma.workEntry.update({
    where: { id },
    data: { status: 'CANCELLED', updatedById: userId },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'ENTRY_CANCELLED',
      entityType: 'WorkEntry',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: 'CANCELLED', reason: reason ?? null },
      ipAddress: req.ip,
    },
  });

  return res.json({ entry: { id: updated.id, status: updated.status } });
}

// -----------------------------------------------------------------------
// Approve
// -----------------------------------------------------------------------

export async function approveEntry(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, role } = req.user!;

  if (role === 'OWNER') {
    const perm = await getOwnerPermission(userId);
    if (!perm?.canApproveEntries) {
      throw new AppError(403, 'You do not have permission to approve entries.');
    }
  }

  const existing = await prisma.workEntry.findUnique({
    where: { id },
    include: { financial: true },
  });
  if (!existing) throw new AppError(404, 'Entry not found.');
  if (existing.status === 'CANCELLED') {
    throw new AppError(400, 'A cancelled entry cannot be approved.');
  }
  if (existing.status === 'APPROVED') {
    throw new AppError(400, 'This entry is already approved.');
  }
  if (!existing.financial) {
    throw new AppError(400, 'Add an amount for this entry before approving it.');
  }

  const updated = await prisma.workEntry.update({
    where: { id },
    data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'ENTRY_APPROVED',
      entityType: 'WorkEntry',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: 'APPROVED' },
      ipAddress: req.ip,
    },
  });

  return res.json({ entry: { id: updated.id, status: updated.status } });
}
