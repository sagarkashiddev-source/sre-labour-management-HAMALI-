import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies a correct password against its own hash', async () => {
    const hash = await hashPassword('Password123!');
    await expect(verifyPassword('Password123!', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('Password123!');
    await expect(verifyPassword('WrongPassword!', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const hashA = await hashPassword('Password123!');
    const hashB = await hashPassword('Password123!');
    expect(hashA).not.toBe(hashB);
  });

  it('never stores the plaintext password in the hash', async () => {
    const hash = await hashPassword('Password123!');
    expect(hash).not.toContain('Password123!');
  });
});
