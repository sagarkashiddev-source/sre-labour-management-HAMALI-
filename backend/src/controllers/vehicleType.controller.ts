import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';

// Readable by all authenticated roles (needed for every entry form's Type
// dropdown). Mutation is Admin-only, per spec section 28 ("Settings ->
// Work Types") — unlike companies, this isn't Owner-configurable.
export async function listVehicleTypes(_req: Request, res: Response) {
  const types = await prisma.vehicleType.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
  });
  return res.json({ vehicleTypes: types });
}

const typeSchema = z.object({ name: z.string().min(1, 'Type name is required.') });

export async function createVehicleType(req: Request, res: Response) {
  const data = typeSchema.parse(req.body);

  const type = await prisma.$transaction(async (tx) => {
    const t = await tx.vehicleType.create({ data });
    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'VEHICLE_TYPE_CREATED',
        entityType: 'VehicleType',
        entityId: t.id,
        newValue: data,
        ipAddress: req.ip,
      },
    });
    return t;
  });

  return res.status(201).json({ vehicleType: type });
}

export async function disableVehicleType(req: Request, res: Response) {
  const { id } = req.params;
  const existing = await prisma.vehicleType.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Type not found.');

  const type = await prisma.$transaction(async (tx) => {
    const t = await tx.vehicleType.update({ where: { id }, data: { status: 'DISABLED' } });
    // Previously missing entirely, same gap as Company's disable — added
    // for the same reason.
    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'VEHICLE_TYPE_DISABLED',
        entityType: 'VehicleType',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: 'DISABLED' },
        ipAddress: req.ip,
      },
    });
    return t;
  });

  return res.json({ vehicleType: type });
}
