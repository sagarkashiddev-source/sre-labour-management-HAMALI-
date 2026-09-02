import { Request, Response } from 'express';
import { z } from 'zod';
import { verifyPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Phone or email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const COOKIE_NAME = 'sre_token';

export async function login(req: Request, res: Response) {
  const { identifier, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ phone: identifier }, { email: identifier }],
    },
  });

  // Same generic message whether the user doesn't exist or the password is
  // wrong — never reveal which one, and never leak the password hash.
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'Invalid phone/email or password.');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid phone/email or password.');
  }

  const token = signToken({ userId: user.id, role: user.role });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    },
  });

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      phone: user.phone,
      email: user.email,
    },
  });
}

export async function logout(req: Request, res: Response) {
  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: req.user.userId,
        ipAddress: req.ip,
      },
    });
  }
  res.clearCookie(COOKIE_NAME);
  return res.json({ ok: true });
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated.');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      ownerPermission: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'Session no longer valid.');
  }

  return res.json({ user });
}
