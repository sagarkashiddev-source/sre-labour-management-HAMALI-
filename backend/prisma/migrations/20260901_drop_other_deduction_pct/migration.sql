-- Removes calculation_rules.otherDeductionPct.
--
-- This column was added to the schema and accepted by the create-rule API,
-- but was never read anywhere: calculation.service.ts's
-- calculateEntryFinancials() never applies it, EntryFinancial never
-- snapshots it, no report or export uses it, and the Admin Settings UI
-- never exposed a field to set it. Any value saved into it was inert. Per
-- the project's "implement or remove" decision on this field, it's removed
-- here rather than left as a dead, misleading column that looks
-- configurable but silently does nothing.
--
-- Non-destructive to anything actually in use: no other column, table, or
-- row is touched, and this column's values (all effectively unused) are
-- simply dropped along with it.

ALTER TABLE "calculation_rules" DROP COLUMN IF EXISTS "otherDeductionPct";
