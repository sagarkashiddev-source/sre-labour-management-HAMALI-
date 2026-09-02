# SRE — Hamali Management System — Backend (Phase 1)

Backend for **Sagar Roadways and Enterprises (SRE)**, replacing the manual
`SR HAMALI 2026-27.xlsx` workflow.

This is **Phase 1** of the build order in the spec: authentication, roles,
and the database schema — enough to log in as Admin / Owner / Labour and
exercise real role-based access control end to end. Entries, financials,
reports, and exports are Phase 2+.

## What's implemented

- PostgreSQL schema (Prisma) modeling Users, Companies, Vehicle Types, Work
  Entries, **Entry Financials (separate table)**, Daily Attendance,
  Calculation Rules, Owner Permissions, Audit Logs.
- Password hashing (bcrypt), JWT auth via httpOnly cookie, rate-limited
  login.
- Role-based route gating (`requireRole`) and a field-level `select`
  allowlist pattern (`entrySelectFor`) so financial fields are never even
  queried for a Labour request — not filtered out after the fact.
- Seed script with Admin / Owner / Labour demo logins and calculation rules
  that match the workbook's real history (see below).

## Phase 2 — Work entries, amounts, approval workflow

- `POST /api/entries` — create. Labour is restricted to the 6 operational
  fields by the request schema itself (there is no amount field to smuggle
  through). Duplicate detection: same date + vehicle + company + load/unload
  returns `409` with a warning instead of silently creating a duplicate;
  pass `force: true` to proceed anyway (spec section 22).
- `GET /api/entries`, `GET /api/entries/:id` — list/get, filtered by role.
  Labour always sees only their own entries, regardless of query params.
  Uses `entrySelectFor()` from Phase 1 so financial fields are never
  queried for Labour or an unauthorized Owner. Cancelled entries are hidden
  by default (spec section 21) unless `?status=CANCELLED` is explicit.
- `PATCH /api/entries/:id` — edit. Labour can only edit their **own**
  entries, and only while status is still `PENDING` — once Admin/Owner acts
  on it, further correction goes through Admin (spec section 7/12). Every
  changed field is written to `audit_logs` as an old→new diff.
- `PATCH /api/entries/:id/cancel` — Admin, or Owner with
  `canCancelEntries`. Soft cancel only (status flips to `CANCELLED`); the
  record and its history are never deleted.
- `PATCH /api/entries/:id/approve` — Admin, or Owner with
  `canApproveEntries`. Refuses if no `EntryFinancial` exists yet ("Add an
  amount before approving this entry").
- `POST /api/entries/:id/financials` — Admin, or Owner with
  `canEditAmount`. Runs the verified two-stage calculation
  (`calculation.service.ts`) using whichever `CalculationRule` is active for
  that entry's date, and records both the percentages *and* the computed
  amounts as a snapshot — so a later change to the rule never silently
  rewrites a past entry's numbers.
- `GET /api/entries/:id/financials/preview?amount=5000` — live calculation
  preview for the "Calculation Preview" card (spec section 19), without
  saving anything.
- `GET/POST/PATCH /api/companies`, `GET/POST/PATCH /api/vehicle-types` —
  dropdown data for every entry form. GET is open to all roles (Labour
  needs it too); mutation is Admin, or for companies specifically an Owner
  with `canManageCompanies` (vehicle types are Admin-only per spec section
  28, not Owner-configurable).

Route-level gates (`requireRole`) block Labour from financials, cancel, and
approve entirely — before the request body is even parsed. Owner's
finer-grained permission flags are then checked inside the controller,
since those are per-user grants rather than a flat role.

## Phase 3 — Reports, Excel/PDF export, attendance

- `POST /api/attendance/day`, `GET /api/attendance/day` — Admin-only manual
  daily headcount roster. Added because Per Person/report accuracy depends
  on it directly — this is the "Present" number, and per Phase 1's findings
  it is **never** derived from entry count.
- `GET /api/reports/daily?date=` — single-day summary (gross/deduction/net,
  present, per-person) for dashboard "Today" cards.
- `GET /api/reports/monthly?month=&year=` — the workbook's per-day summary
  structure (spec section 21): Date, Gross, Deduction, Net, Present, Per
  Person, plus month totals (spec section 15) including average per person.
  Only `APPROVED` entries count — `PENDING` may not even have an amount yet,
  and `CANCELLED` is always excluded from reports.
- `GET /api/reports/company?companyId=&from=&to=` — entry-level breakdown
  for one company over a date range (spec section 16), with totals.
- `GET /api/reports/labour?labourId=&month=&year=` — per labourer, per day:
  entries logged (informational "Work" column), attendance, and
  **calculatedPayment = that day's per-person share on days they were
  present** — not tied to which specific entries they personally created,
  matching spec section 17's actual column set (Date, Work, Attendance,
  Calculated Payment).
- `GET /api/reports/monthly/export/excel` — real `.xlsx` via ExcelJS,
  reproducing the workbook's per-day summary sheet layout. Totals row uses
  live `SUM()` formulas, not hardcoded numbers, and the sheet is set up for
  A4 landscape printing.
- `GET /api/reports/monthly/export/pdf` — real A4 PDF via PDFKit: repeated
  table header on every page, automatic page breaks, page numbers, business
  name/address, report period, and generated-date footer (spec section 19).

**Permission gating**: every report/export route is blocked outright for
LABOUR at the route level (`requireRole('ADMIN','OWNER')`), matching the
permission matrix's flat "❌" for Labour. Owner's four separate flags
(`canViewFinancialReports`, `canExportExcel`, `canExportPdf`, plus the
existing `canViewFinancials`) are then checked individually inside the
controllers, since the spec treats "view a report" and "export it" as
distinct configurable grants, not one blanket toggle.

## Phase 4 — Audit log viewer, Calculation Rules Settings

- `GET /api/audit-logs` — filterable log viewer (entityType, entityId,
  userId, action, date range, paginated). **Admin sees everything. Owner's
  access is "Limited"** exactly as spec section 47's matrix states: gated
  by the `canViewAuditLogsLimited` flag, and even then scoped to only
  `WorkEntry` / `EntryFinancial` history — never User, Company, System, or
  VehicleType changes, and an Owner cannot widen that by passing a
  different `entityType` query param. If that same Owner lacks
  `canViewFinancials`, the actual amounts inside `EntryFinancial` audit
  entries are redacted to `"Financial details hidden."` rather than shown —
  audit-log access doesn't become a backdoor around the financials
  permission.
- `GET /api/audit-logs/history/:entityType/:entityId` — single-entity
  timeline (spec section 12/25's "View Audit History" action on one entry),
  same access rules.
- `GET /api/calculation-rules`, `POST /api/calculation-rules` — Admin-only,
  flat, no Owner exception (matrix: Calculation Settings ❌ for Owner).
  **Deliberately append-only — there is no PATCH/DELETE.** Correcting a
  percentage means adding a new rule with a new `effectiveFrom` date, the
  same way the real business already changed it three times in the source
  workbook. Allowing in-place edits would make "what rule was active on 15
  June" unanswerable later — that's the exact Excel failure mode (silently
  overwritten history) this system replaces. Two rules can't share the same
  `effectiveFrom` date (checked before insert).
- `GET /api/calculation-rules/active?date=` — reuses the same
  `getActiveRuleForDate()` the financial engine itself uses, so Admin's
  Settings screen shows literally the rule that will apply, not a
  reimplementation that could drift out of sync.

## What's NOT yet built (Phase 5+)

Notifications (new entry / correction / pending approval / cancelled entry
alerts to Admin — spec section 27), PWA + offline entry caching + sync,
frontend (all of it — Admin dashboard, Owner dashboard, Labour's mobile
entry flow), automated tests, deployment config. Route files are structured
so these slot in the same way the existing ones do.

## Calculation logic — verified from your workbook, not guessed

I inspected the actual formulas in `SR_HAMALI_2026-27.xlsx` (not just the
displayed values). The deduction model **changed over time**:

| Period | Model |
|---|---|
| March–April 2026 | Flat 30% deduction: `Net = Amount − (Amount × 30%)` |
| May 2026 | Flat 20% deduction |
| **June–July 2026 (current)** | **Two-stage:** `Company Deduction = Amount × 10%` → `Balance = Amount − Company Deduction` → `Labour Deduction = Balance × 20%` (of the *remainder*, not the original amount) → `Net = Balance − Labour Deduction` |

Example from the workbook (₹5,000 entry): ₹500 company deduction → ₹4,500
balance → ₹900 labour deduction (20% of ₹4,500) → **₹3,600 net**. This
matches the spec's section 19 example exactly.

`Per Person` = sum of that day's Net Amount ÷ `Present` headcount. **`Present`
is entered manually per day in the workbook — it is not a count of that
day's entries.** I modeled it as its own `DailyAttendance` table rather than
deriving it, since deriving it would silently produce wrong numbers whenever
headcount differs from entry count (which it does, throughout the sheet).

`CalculationRule` is versioned by `effectiveFrom` date specifically because
the business already changed the percentages three times in five months —
the seed data reproduces all three historical rules plus the current one, so
you can sanity-check old months' numbers against the workbook if we later
backfill historical entries.

**One data-quality issue to flag, not silently fix:** the workbook's `TYPE`
column has inconsistent free text for what look like the same vehicle
categories — `909`, `9090`, `99`, `40FT`, `40 FT`, `909(ACE)` all appear
separately across ~4,000 entries. The schema uses a managed `VehicleType`
table instead of free text, but you (or Admin) should confirm the canonical
list — I seeded a reasonable guess (`909, PIK-UP, TOURS, ACE, 1109, 32FT,
40FT, DOST`) but didn't try to auto-merge the typo'd variants since I can't
be sure which merges you'd want.

## Setup

Requires Node 20+, PostgreSQL 14+.

```bash
cp .env.example .env
# edit .env: set DATABASE_URL to your Postgres instance, set a real JWT_SECRET

npm install
npm run prisma:generate
npm run prisma:migrate      # creates the database tables
npm run prisma:seed         # LOCAL DEV ONLY — see warning below
npm run dev                 # starts on http://localhost:4000
```

> **Never run `prisma:seed` against a production/shared database.** It
> creates demo accounts with a fixed password documented right here in
> this README (`Password123!`) — anyone who can read this file can log
> in. It refuses to run when `NODE_ENV=production` as a backstop, but
> treat that as a safety net, not the plan. For a real deployment, use
> `npm run prisma:bootstrap-admin` instead (see the root
> [DEPLOY_RAILWAY.md](../DEPLOY_RAILWAY.md)), which creates only the
> Admin account with either an operator-supplied password or a randomly
> generated one printed exactly once.

Demo logins after seeding (all password `Password123!`):

| Role | Phone |
|---|---|
| Admin | 9922297341 |
| Owner | 9000000001 |
| Labour | 9000000101 |

## Try the RBAC end to end

```bash
# Log in as Labour
curl -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"9000000101","password":"Password123!"}'

# Labour hitting the Admin-only users endpoint -> 403, not a leaked list
curl -b cookies.txt http://localhost:4000/api/users

# Labour creating an entry (only the 6 allowed fields)
curl -b cookies.txt -X POST http://localhost:4000/api/entries \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-08-20","vehicleNo":"mh12ab1234","vehicleTypeId":"<id from GET /api/vehicle-types>","loadUnload":"LOAD","companyId":"<id from GET /api/companies>","remark":"Regular work"}'

# Labour trying to reach financials -> 403 before the body is even read
curl -b cookies.txt -X POST http://localhost:4000/api/entries/<entryId>/financials \
  -H "Content-Type: application/json" -d '{"amount":5000}'

# Log in as Admin, then set the amount and check the calculation
curl -c admin_cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" -d '{"identifier":"9922297341","password":"Password123!"}'
curl -b admin_cookies.txt -X POST http://localhost:4000/api/entries/<entryId>/financials \
  -H "Content-Type: application/json" -d '{"amount":5000}'
# -> companyDeduction 500, balanceAfterCompany 4500, labourDeduction 900, netAmount 3600

# Approve it, then record today's attendance
curl -b admin_cookies.txt -X PATCH http://localhost:4000/api/entries/<entryId>/approve
curl -b admin_cookies.txt -X POST http://localhost:4000/api/attendance/day \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-08-20","presentLabourIds":["<labour1 id>","<labour2 id>"]}'

# Pull the monthly report and export it
curl -b admin_cookies.txt "http://localhost:4000/api/reports/monthly?month=8&year=2026"
curl -b admin_cookies.txt "http://localhost:4000/api/reports/monthly/export/excel?month=8&year=2026" -o report.xlsx
curl -b admin_cookies.txt "http://localhost:4000/api/reports/monthly/export/pdf?month=8&year=2026" -o report.pdf

# Labour can never reach any report route, even their own
curl -b cookies.txt "http://localhost:4000/api/reports/labour?labourId=<labour1 id>&month=8&year=2026"
# -> 403

# Owner (limited audit access) sees only WorkEntry/EntryFinancial history
curl -c owner_cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" -d '{"identifier":"9000000001","password":"Password123!"}'
curl -b owner_cookies.txt "http://localhost:4000/api/audit-logs?entityType=User"
# -> 403, even though the Owner's canViewAuditLogsLimited flag is true

# Admin adds a corrected calculation rule going forward (never edits history)
curl -b admin_cookies.txt -X POST http://localhost:4000/api/calculation-rules \
  -H "Content-Type: application/json" \
  -d '{"effectiveFrom":"2026-09-01","companyDeductionPct":10,"labourDeductionPct":25,"note":"Labour deduction raised to 25% from September."}'
```

## A note on this environment

I built this schema/code without running `prisma generate` against a live
database, since this sandbox's network allowlist doesn't include Prisma's
binary download host. The Prisma schema and TypeScript were reviewed
carefully by hand, but please run `npm run prisma:generate` and `npm run
build` yourself as the first step to catch anything that needs adjusting —
don't assume it's compiler-verified.

## Next: Phase 2

Work entry CRUD (Labour's 6-field form + Admin's full entry, with the
`entrySelectFor` pattern applied), duplicate-entry warning, and the
PENDING → APPROVED/CANCELLED status workflow.
