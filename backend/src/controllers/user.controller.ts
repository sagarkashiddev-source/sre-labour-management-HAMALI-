import { Request, Response } from 'express';
import { z } from 'zod';
import { hashPassword } from '../auth/password';
import { AppError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ users });
}

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  phone: z.string().min(10, 'A valid phone number is required.'),
  email: z.string().email().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.enum(['ADMIN', 'OWNER', 'LABOUR']),
  employeeCode: z.string().optional(), // required if role === LABOUR
});

export async function createUser(req: Request, res: Response) {
  const data = createUserSchema.parse(req.body);

  if (data.role === 'LABOUR' && !data.employeeCode) {
    throw new AppError(400, 'Employee code is required for Labour users.');
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        passwordHash,
        role: data.role,
        ...(data.role === 'LABOUR'
          ? { labourProfile: { create: { employeeCode: data.employeeCode! } } }
          : {}),
        ...(data.role === 'OWNER' ? { ownerPermission: { create: {} } } : {}),
      },
      select: { id: true, name: true, phone: true, role: true },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: u.id,
        newValue: { name: u.name, role: u.role },
        ipAddress: req.ip,
      },
    });

    return u;
  });

  return res.status(201).json({ user });
}

export async function disableUser(req: Request, res: Response) {
  const { id } = req.params;
  const { userId: requesterId } = req.user!;

  // Self-disable is blocked outright: an Admin locking out their own only
  // account (or any user disabling themselves mid-session) is never a
  // legitimate action here — it's either a mistake or something that
  // should go through a different, deliberate account-closure flow, not
  // this button.
  if (id === requesterId) {
    throw new AppError(400, 'You cannot disable your own account.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) throw new AppError(404, 'User not found.');
    if (target.status === 'DISABLED') {
      throw new AppError(400, 'This user is already disabled.');
    }

    // The last remaining ACTIVE Admin can never be disabled — doing so
    // would leave the system with no one able to manage users, approve
    // entries as Admin, or reverse the mistake, which is an unrecoverable
    // lockout without going around the application (direct DB access).
    // Checked inside the same transaction as the update so a concurrent
    // "disable the other admin" request can't race past this count.
    if (target.role === 'ADMIN') {
      const activeAdminCount = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (activeAdminCount <= 1) {
        throw new AppError(400, 'Cannot disable the last remaining active Admin account.');
      }
    }

    const t = await tx.user.update({
      where: { id },
      data: { status: 'DISABLED' },
      select: { id: true, name: true, status: true },
    });

    await tx.auditLog.create({
      data: {
        userId: requesterId,
        action: 'USER_DISABLED',
        entityType: 'User',
        entityId: t.id,
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'DISABLED' },
        ipAddress: req.ip,
      },
    });

    return t;
  });

  return res.json({ user: updated });
}
