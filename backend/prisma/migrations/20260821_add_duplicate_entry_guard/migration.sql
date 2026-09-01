-- Additive, non-destructive migration. Adds a partial unique index so the
-- database itself rejects a true duplicate work entry (same date, vehicle,
-- company, load/unload, excluding CANCELLED rows), closing the check-then-
-- insert race condition in entry.controller.ts's createEntry: two
-- near-simultaneous requests could previously both pass the application-
-- level duplicate check before either row committed.
--
-- This does NOT touch existing data or drop anything. If duplicate rows
-- already exist in your data before this runs, CREATE UNIQUE INDEX will
-- fail with a clear Postgres error naming the conflicting rows — resolve
-- those first (cancel one of each pair) rather than forcing this through.
--
-- Apply with: npx prisma migrate deploy   (or `migrate dev` in development)
-- This could not be run or verified against a live database in the
-- environment this was written in — verify it against a copy of your data
-- before applying to production, per this project's own database-safety rule.

CREATE UNIQUE INDEX IF NOT EXISTS "work_entries_duplicate_guard"
ON "work_entries" ("date", "vehicleNo", "companyId", "loadUnload")
WHERE "status" != 'CANCELLED';
