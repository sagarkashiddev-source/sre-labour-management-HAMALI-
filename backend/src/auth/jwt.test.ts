import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from './jwt';

describe('jwt', () => {
  it('round-trips a payload through sign and verify', () => {
    const token = signToken({ userId: 'user-123', role: 'ADMIN' as any });
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user-123');
    expect(decoded.role).toBe('ADMIN');
  });

  it('rejects a tampered token', () => {
    const token = signToken({ userId: 'user-123', role: 'LABOUR' as any });
    const tampered = token.slice(0, -2) + (token.slice(-2) === 'aa' ? 'bb' : 'aa');
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('rejects garbage input', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });
});
