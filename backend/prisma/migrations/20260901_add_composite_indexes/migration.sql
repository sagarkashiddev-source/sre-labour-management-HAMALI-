-- Composite indexes for work_entries, added by reviewing the actual query
-- shapes this codebase runs (not a guess, and not from a live EXPLAIN
-- ANALYZE against production-scale data — this sandbox has no live
-- database, so these are derived from the WHERE + ORDER BY clauses in the
-- code itself). Treat this as the first pass; once there's real production
-- data volume, run EXPLAIN ANALYZE against the slowest of these queries
-- and adjust column order / add a partial index if the planner disagrees
-- with the reasoning below.
--
-- 1. work_entries_status_date_createdAt_idx (status, date, createdAt)
--    Serves listEntries' default call (entry.controller.ts): filters on
--    status (defaults to "not CANCELLED") and often a date range, ordered
--    by [date desc, createdAt desc] for pagination. This is the single
--    most frequently run query in the app (every role's main Entries
--    screen) and previously had to combine two separate single-column
--    indexes (date, status) via a bitmap AND, then sort the result
--    separately — this composite lets Postgres walk the index in the
--    exact output order and stop early once `pageSize` rows are found.
--    Also serves report.service.ts's computeDailyRows/computeMonthlyBillRows,
--    which filter status='APPROVED' + a date range every time a report or
--    the monthly Bill (item 0) is generated.
--
-- 2. work_entries_duplicate_check_idx (vehicleNo, date, companyId, loadUnload)
--    Serves the duplicate-entry check that runs on EVERY entry creation
--    (entry.controller.ts createEntry, inside the advisory-lock
--    transaction — see migration 20260901_drop_duplicate_guard_index) and
--    financial.controller.ts's amount-lookup path: an exact match on all
--    four columns. This turns that check into a direct index lookup
--    instead of scanning the single-column vehicleNo or date index and
--    filtering the rest of the columns row-by-row.
--
-- 3. work_entries_createdById_status_date_idx (createdById, status, date)
--    Serves two real callers: LABOUR's own filtered entries list
--    (listEntries forces createdById = the logged-in labourer), and
--    computeLabourReport's WorkEntry.groupBy(where: {status, date range,
--    createdById}) — the monthly per-labourer report's "Work" column,
--    which runs once per labourer per report generation.

CREATE INDEX IF NOT EXISTS "work_entries_status_date_createdAt_idx"
  ON "work_entries" ("status", "date", "createdAt");

CREATE INDEX IF NOT EXISTS "work_entries_duplicate_check_idx"
  ON "work_entries" ("vehicleNo", "date", "companyId", "loadUnload");

CREATE INDEX IF NOT EXISTS "work_entries_createdById_status_date_idx"
  ON "work_entries" ("createdById", "status", "date");
