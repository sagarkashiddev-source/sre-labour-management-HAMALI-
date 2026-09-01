import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  role: Role;
}

export function signToken(payload: JwtPayload): string {
  // jsonwebtoken's types want a literal-typed duration string ("8h", "7d",
  // etc). env.jwtExpiresIn is a plain string read from process.env, so we
  // narrow it at the call site rather than widening SignOptions globally.
  const options: jwt.SignOptions = { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
