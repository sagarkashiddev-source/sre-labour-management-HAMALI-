import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Converts internal errors into the short, plain-language messages the UI
 * spec requires (e.g. "Vehicle number is required." not "400 Bad Request").
 * Register this LAST, after all routes.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    const first = err.errors[0];
    return res.status(400).json({ error: first?.message ?? 'Invalid input.' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
