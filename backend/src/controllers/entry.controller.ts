import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { entrySelectFor } from '../middleware/rbac.middleware';
import { getOwnerPermission } from '../services/permission.service';
import { normalizeVehicleNo, isPlausibleVehicleNo } from '../utils/normalize';
import { prisma } from '../lib/prisma';

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

// Thrown inside the createEntry transaction to abort the insert and signal
// "ask the user to confirm" back out to the HTTP handler, without letting a
// duplicate-warning response leak out as a committed DB write.
class DuplicateNeedsConfirmation {
  constructor(public duplicateEntryId: string) {}
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

  // Duplicate check + insert happen inside one transaction, serialized by a
  // Postgres advisory lock keyed on (date, vehicleNo, companyId, loadUnload).
  // This closes the check-then-insert race condition WITHOUT a hard DB
  // unique constraint: a real DB constraint can't see the `force` flag, so
  // it can't tell "accidental double-submit" from "user confirmed this
  // repeat trip is real" — and the business genuinely has same-day repeat
  // trips (same vehicle/company/load-unload, several times) that must be
  // allowed through once force=true. The advisory lock only serializes
  // concurrent requests for the same key; it never blocks a forced create.
  const lockKey = `${body.date.toISOString()}|${vehicleNo}|${body.companyId}|${body.loadUnload}`;

  const entry = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const duplicate = await tx.workEntry.findFirst({
      where: {
        date: body.date,
        vehicleNo,
        companyId: body.companyId,
        loadUnload: body.loadUnload,
        status: { not: 'CANCELLED' },
      },
      select: { id: true, createdAt: true },
    });

    if (duplicate && !body.force) {
      // Signal "needs confirmation" out of the transaction via a thrown
      // sentinel rather than a raw HTTP response, since we're inside $transaction.
      throw new DuplicateNeedsConfirmation(duplicate.id);
    }

    const created = await tx.workEntry.create({
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

    // Audit log write lives INSIDE the same transaction as the insert — see
    // the module-level note above DuplicateNeedsConfirmation / the other
    // controllers in this file: a DB write and its audit-log entry must
    // commit together or not at all, for a system whose whole point is a
    // trustworthy audit trail. Previously this was a second, separate
    // `await prisma.auditLog.create(...)` call after the transaction had
    // already committed — if the process crashed or the DB connection
    // dropped in between, the entry would exist with no audit record of
    // its own creation.
    await tx.auditLog.create({
      data: {
        userId,
        action: 'ENTRY_CREATED',
        entityType: 'WorkEntry',
        entityId: created.id,
        newValue: {
          vehicleNo, date: body.date, companyId: body.companyId, loadUnload: body.loadUnload,
        } as Prisma.InputJsonValue, // body.date is a Date — same JSON-field typing note as below
        ipAddress: req.ip,
      },
    });

    return created;
  }).catch((err) => {
    if (err instanceof DuplicateNeedsConfirmation) return err;
    throw err;
  });

  if (entry instanceof DuplicateNeedsConfirmation) {
    return res.status(409).json({
      warning: 'A similar entry already exists. Are you sure you want to continue?',
      duplicateEntryId: entry.duplicateEntryId,
    });
  }

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

  // APPROVED entries are locked for EVERY role, including ADMIN — not just
  // Labour. An approved entry has already been counted in a report/bill;
  // silently editing it in place would recreate the exact "silently
  // overwritten history" problem this whole system exists to fix (see
  // schema.prisma's note on CalculationRule). The only way back in is the
  // explicit reopenEntry() correction workflow (ADMIN-only, reason
  // required, fully audited), which drops the entry back to PENDING first.
  if (existing.status === 'APPROVED') {
    throw new AppError(
      403,
      'This entry is approved and locked. Ask an Admin to reopen it for correction before editing.',
    );
  }
  if (existing.status === 'CANCELLED') {
    throw new AppError(403, 'This entry is cancelled and cannot be edited.');
  }

  if (role === 'LABOUR') {
    if (existing.createdById !== userId) {
      throw new AppError(403, 'You can only edit your own entries.');
    }
    // Labour is restricted to operationalFieldsSchema by the schema itself —
    // no amount/financial field exists on this schema to smuggle through.
    // (status is already guaranteed PENDING here by the check above.)
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

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.workEntry.update({ where: { id }, data: updateData });
    // Same atomicity rule as createEntry: the update and its audit log
    // commit together or not at all.
    await tx.auditLog.create({
      data: {
        userId,
        action: 'ENTRY_UPDATED',
        entityType: 'WorkEntry',
        entityId: id,
        oldValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])) as Prisma.InputJsonValue,
        newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])) as Prisma.InputJsonValue,
        ipAddress: req.ip,
      },
    });
    return u;
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

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.workEntry.update({
      where: { id },
      data: { status: 'CANCELLED', updatedById: userId },
    });
    await tx.auditLog.create({
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
    return u;
  });

  return res.json({ entry: { id: updated.id, status: updated.status } });
}

// -----------------------------------------------------------------------
// Reopen for correction (ADMIN only — the entire point of locking approved
// entries is that going back in requires a deliberate, reasoned, audited
// step, never a silent edit).
// -----------------------------------------------------------------------

const reopenSchema = z.object({
  reason: z.string().min(3, 'A reason is required to reopen an approved entry.').max(500),
});

export async function reopenEntry(req: Request, res: Response) {
  const { id } = req.params;
  const { userId } = req.user!;
  // Route is ADMIN-only (see entry.routes.ts) — Owner, even with every
  // other financial permission granted, cannot reopen an approved entry.
  const { reason } = reopenSchema.parse(req.body);

  const existing = await prisma.workEntry.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Entry not found.');
  if (existing.status !== 'APPROVED') {
    throw new AppError(400, 'Only an approved entry can be reopened for correction.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.workEntry.update({
      where: { id },
      data: {
        status: 'PENDING',
        approvedById: null,
        approvedAt: null,
        updatedById: userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: 'ENTRY_REOPENED_FOR_CORRECTION',
        entityType: 'WorkEntry',
        entityId: id,
        // approvedAt is a Date — Prisma's Json input type doesn't include
        // Date structurally, but JSON.stringify (which Prisma uses to
        // serialize this for the DB) calls Date's own .toJSON() and gets a
        // normal ISO string, so this is safe at runtime; the cast just
        // tells TS to trust that instead of rejecting the object shape.
        oldValue: { status: 'APPROVED', approvedById: existing.approvedById, approvedAt: existing.approvedAt } as Prisma.InputJsonValue,
        newValue: { status: 'PENDING', reason },
        ipAddress: req.ip,
      },
    });
    return u;
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

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.workEntry.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
    });
    await tx.auditLog.create({
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
    return u;
  });

  return res.json({ entry: { id: updated.id, status: updated.status } });
}
