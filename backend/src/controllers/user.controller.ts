import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../auth/password';
import { AppError } from '../middleware/error.middleware';

const prisma = new PrismaClient();

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

  const user = await prisma.user.create({
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

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      newValue: { name: user.name, role: user.role },
      ipAddress: req.ip,
    },
  });

  return res.status(201).json({ user });
}

export async function disableUser(req: Request, res: Response) {
  const { id } = req.params;

  const target = await prisma.user.update({
    where: { id },
    data: { status: 'DISABLED' },
    select: { id: true, name: true, status: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: 'USER_DISABLED',
      entityType: 'User',
      entityId: target.id,
      ipAddress: req.ip,
    },
  });

  return res.json({ user: target });
}
