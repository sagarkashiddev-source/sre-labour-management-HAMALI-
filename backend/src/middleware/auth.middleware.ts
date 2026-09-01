import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';

/**
 * Requires a valid JWT (from the httpOnly "sre_token" cookie, or an
 * Authorization: Bearer header as a fallback for non-browser clients).
 * Attaches req.user = { userId, role } on success.
 *
 * This is the FIRST line of defense. Role- and field-level authorization
 * happens in rbac.middleware.ts and in the service/query layer — never rely
 * on this alone, and never rely on the frontend hiding a field.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.sre_token;
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;

  const token = cookieToken ?? headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  }

  try {
    const payload = verifyToken(token);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}
