import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { getOwnerPermission } from '../services/permission.service';

const prisma = new PrismaClient();

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

// Readable by ALL authenticated roles (Labour needs this for the entry
// form's searchable dropdown, spec section 37) — mutation is gated below.
export async function listCompanies(req: Request, res: Response) {
  const q = listQuerySchema.parse(req.query);
  const companies = await prisma.company.findMany({
    where: {
      status: q.status ?? 'ACTIVE',
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
    take: 50, // dropdown-sized page; full management list can raise this
  });
  return res.json({ companies });
}

async function assertCanManageCompanies(userId: string, role: 'ADMIN' | 'OWNER' | 'LABOUR') {
  if (role === 'ADMIN') return;
  if (role === 'OWNER') {
    const perm = await getOwnerPermission(userId);
    if (!perm?.canManageCompanies) {
      throw new AppError(403, 'You do not have permission to manage companies.');
    }
    return;
  }
  throw new AppError(403, 'You do not have permission to manage companies.');
}

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required.'),
  code: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function createCompany(req: Request, res: Response) {
  await assertCanManageCompanies(req.user!.userId, req.user!.role);
  const data = companySchema.parse(req.body);
  const company = await prisma.company.create({ data });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: 'COMPANY_CREATED',
      entityType: 'Company',
      entityId: company.id,
      newValue: data,
      ipAddress: req.ip,
    },
  });

  return res.status(201).json({ company });
}

export async function updateCompany(req: Request, res: Response) {
  await assertCanManageCompanies(req.user!.userId, req.user!.role);
  const { id } = req.params;
  const data = companySchema.partial().parse(req.body);

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Company not found.');

  const updated = await prisma.company.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: 'COMPANY_UPDATED',
      entityType: 'Company',
      entityId: id,
      oldValue: existing,
      newValue: updated,
      ipAddress: req.ip,
    },
  });

  return res.json({ company: updated });
}

export async function disableCompany(req: Request, res: Response) {
  await assertCanManageCompanies(req.user!.userId, req.user!.role);
  const { id } = req.params;
  const company = await prisma.company.update({ where: { id }, data: { status: 'DISABLED' } });
  return res.json({ company });
}
