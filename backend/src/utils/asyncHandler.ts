import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Express 4 does not forward rejected promises from async route handlers to
 * the error middleware automatically. Wrap every async controller with
 * this so thrown errors (AppError, ZodError, etc.) reach errorHandler
 * instead of crashing the process / hanging the request.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
