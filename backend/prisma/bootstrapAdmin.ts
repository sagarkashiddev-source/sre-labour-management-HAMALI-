import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Creates the FIRST Admin account for a real deployment. This is the
 * production-safe replacement for running `prisma:seed` (demo data, fixed
 * password "Password123!") against a real database — see the guard and
 * comment at the top of prisma/seed.ts for why that was a genuine
 * vulnerability, not just a style concern.
 *
 * Usage (see DEPLOY_RAILWAY.md):
 *   ADMIN_NAME="Sagar" ADMIN_PHONE="9922297341" ADMIN_EMAIL="admin@sre.local" \
 *     npm run prisma:bootstrap-admin
 *
 * Password handling:
 *   - If ADMIN_PASSWORD is set in the environment, that password is used
 *     (useful for scripted/non-interactive setups where the operator
 *     already generated and stored a secret via their own secrets
 *     manager). It must be at least 12 characters.
 *   - Otherwise, a cryptographically random 20-character password is
 *     generated and printed to stdout EXACTLY ONCE. It is never written to
 *     a file, never logged again, and this script has no way to recover
 *     it afterwards — the operator must capture it immediately (e.g. into
 *     their password manager) and should change it on first login once
 *     the app has a change-password flow.
 *
 * Idempotency, deliberately NOT upsert-and-silently-continue:
 *   - If a user already exists at ADMIN_PHONE, this script refuses to
 *     touch it (no password reset, no role change) and exits non-zero.
 *     Resetting an existing account's password is a separate, deliberate
 *     action an operator should take through a proper admin flow, not a
 *     side effect of re-running a bootstrap script.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function generateStrongPassword(): string {
  // 20 random bytes -> base64url, trimmed to 24 chars: high entropy,
  // no ambiguous-character issues, safe to paste into most password fields.
  return crypto.randomBytes(20).toString('base64url').slice(0, 24);
}

async function main() {
  const name = required('ADMIN_NAME');
  const phone = required('ADMIN_PHONE');
  const email = process.env.ADMIN_EMAIL || undefined;

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    console.error(
      `\nA user already exists with phone ${phone} (role: ${existing.role}, status: ${existing.status}).\n` +
        'This script only creates the first Admin account and will not modify an existing user.\n' +
        'If you need to change a password or role, do that through a proper admin action, not this script.\n',
    );
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = generateStrongPassword();
    generated = true;
  } else if (password.length < 12) {
    console.error('ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: { name, phone, email, passwordHash, role: 'ADMIN' },
    select: { id: true, name: true, phone: true, role: true },
  });

  console.log(`\nAdmin account created: ${admin.name} (${admin.phone}).`);
  if (generated) {
    console.log('\n=== GENERATED PASSWORD (shown once, not stored anywhere) ===');
    console.log(password);
    console.log('=== Save this now. It cannot be recovered by re-running this script. ===\n');
  } else {
    console.log('Password: the ADMIN_PASSWORD you provided.\n');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
