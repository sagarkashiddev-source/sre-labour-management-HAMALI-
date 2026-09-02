# SRE — Sagar Roadways and Enterprises — Hamali Management System

Full-stack replacement for the manual `SR HAMALI 2026-27.xlsx` workflow.
Three roles (Admin, Owner, Labour) sharing one backend, with radically
different frontends per your UI/UX spec's core principle.

## What's here

```
sre/
├── backend/    Node/TypeScript/Express/Prisma/PostgreSQL API (Phases 1-4)
├── frontend/   React/TypeScript/Tailwind/PWA (verified: builds & typechecks clean)
```

Each has its own README with setup steps, demo logins, and — importantly —
an honest account of what's built, what's stubbed, and what's still missing.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env   # edit DATABASE_URL to point at your Postgres
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev             # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev             # http://localhost:5173
```

Log in with any seeded account — Admin `9922297341`, Owner `9000000001`,
Labour `9000000101`, all password `Password123!` — and you'll land on that
role's app.

> **`prisma:seed` is for this local database only.** It creates demo
> accounts with the fixed, publicly-documented password above, and the
> script itself refuses to run when `NODE_ENV=production` as a backstop.
> Deploying for real? See [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md) §4 or
> [DEPLOY_RENDER.md](./DEPLOY_RENDER.md) §5 — both use
> `prisma:bootstrap-admin` instead, which never uses a hardcoded password.

## The one finding that shaped everything

Your workbook's deduction logic **changed over time**: flat 30% (Mar-Apr),
flat 20% (May), then a two-stage 10% company + 20%-of-remainder split
(Jun-Jul, current). That single fact is why `CalculationRule` is versioned
by date rather than a config constant, why every `EntryFinancial` snapshots
the percentages that were active when it was calculated, and why the
Calculation Rules API is append-only — editing a past rule in place would
recreate the exact "silently overwritten history" problem this system
exists to fix.

## Honest status

Built and verified in this session:
- Full Postgres schema + auth + RBAC (Phase 1)
- Work entry CRUD, duplicate detection, amount/approval workflow (Phase 2)
- Reports (daily/monthly/company/labour) + real Excel/PDF export + attendance (Phase 3)
- Audit log viewer + append-only Calculation Rules Settings (Phase 4)
- Full React frontend for all three roles — **typechecks clean and
  produces a real production build**, confirmed by actually running
  `tsc` and `vite build` in this session

Not built: automated test suite, notifications, true offline sync,
deployment config, a couple of secondary detail screens. Each README lists
its own gaps precisely rather than glossing over them.

## A note on trust

Every phase in this project was checked for real errors as it was built —
`tsc --noEmit` on the backend, `tsc -b` and an actual `vite build` on the
frontend — and errors found were fixed, not hidden. The one thing that
could **not** be verified in this sandbox is running the backend against a
live PostgreSQL instance with a generated Prisma client (this sandbox's
network doesn't reach Prisma's binary host). Do that first when you set
this up locally, and treat it as the real first test of Phase 1's schema.
