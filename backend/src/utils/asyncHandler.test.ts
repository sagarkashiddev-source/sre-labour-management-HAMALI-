import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from './asyncHandler';

describe('asyncHandler', () => {
  it('forwards a rejected promise to next(), instead of letting it hang/crash', async () => {
    const boom = new Error('boom');
    const failingController = async () => {
      throw boom;
    };
    const next = vi.fn();

    asyncHandler(failingController as any)({} as any, {} as any, next);

    // The rejection is handled asynchronously (Promise.resolve().catch),
    // so give the microtask queue a turn before asserting.
    await new Promise((r) => setImmediate(r));

    expect(next).toHaveBeenCalledWith(boom);
  });

  it('does not call next() when the controller resolves normally', async () => {
    const okController = async (_req: any, res: any) => {
      res.ok = true;
    };
    const next = vi.fn();
    const res: any = {};

    asyncHandler(okController as any)({} as any, res, next);
    await new Promise((r) => setImmediate(r));

    expect(next).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });
});
