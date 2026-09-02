import { describe, it, expect, vi } from 'vitest';
import { z, ZodError } from 'zod';
import { AppError, errorHandler } from './error.middleware';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('maps an AppError to its own status code and message', () => {
    const res = mockRes();
    errorHandler(new AppError(403, 'You do not have permission to do this.'), {} as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'You do not have permission to do this.' });
  });

  it('maps a ZodError to 400 with the first validation message, not a stack dump', () => {
    const schema = z.object({ amount: z.number().nonnegative('Amount cannot be negative.') });
    let zodError: ZodError;
    try {
      schema.parse({ amount: -5 });
      throw new Error('expected parse to throw');
    } catch (e) {
      zodError = e as ZodError;
    }

    const res = mockRes();
    errorHandler(zodError, {} as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Amount cannot be negative.' });
  });

  it('never leaks internals for an unrecognized error — generic 500 with a plain-language message', () => {
    const res = mockRes();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('some internal stack trace with secrets'), {} as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe('Something went wrong. Please try again.');
    expect(JSON.stringify(payload)).not.toContain('secrets');
    consoleSpy.mockRestore();
  });
});
