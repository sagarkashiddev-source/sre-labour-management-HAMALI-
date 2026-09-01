-- Add optional human-readable user codes for seeded/admin-managed identities.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "userCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_userCode_key" ON "users"("userCode");
