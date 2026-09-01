# SRE — Hamali Management System — Frontend

React + TypeScript + Tailwind + PWA frontend for **Sagar Roadways and
Enterprises (SRE)**, built against the Phase 1-4 backend.

Confirmed working: `npx tsc -b --noEmit` is clean, and `npx vite build`
produces a real production bundle (238 KB JS gzipped to 67 KB, PWA service
worker generated) — this was actually built and run in-sandbox, not just
written and assumed correct.

## The three apps in one codebase

Per the UI spec's core principle, this is genuinely three different
experiences sharing one backend, split by route + layout:

- **`/admin`** — `AdminLayout`: full desktop sidebar (Dashboard, Entries,
  Pending Approvals, Companies, Labour, Attendance, Reports, Users,
  Settings, Audit Logs).
- **`/owner`** — `OwnerLayout`: a short 4-item sidebar. Every page checks
  `user.ownerPermission` and hides amount columns, export buttons, or whole
  sections the way the backend already gates them — the UI reflects real
  permission flags fetched from `/auth/me`, it doesn't independently decide
  what an Owner is "supposed" to see.
- **`/labour`** — `LabourLayout`: bottom nav, 4 items (Home / Entry /
  History / Me), full-screen forms, large touch targets. **The `EntryForm`
  component used by Labour's Add/Edit screens has no amount field in its
  props, state, or markup at all** — this isn't a hidden field, there's
  nothing to hide. Admin's amount entry lives in a completely separate
  component (`AmountEntryCard`) that Labour's page tree never imports.

Role-based routing (`RequireRole`) redirects any user to their own section
if they land on the wrong one — an Owner hitting `/admin` gets bounced to
`/owner`, not shown a 403 page, since they were never trying to break in,
just following a stale link/bookmark.

## Setup

Requires Node 20+ and the Phase 1-4 backend running (see
`backend/README.md`).

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to http://localhost:4000
```

If your backend runs somewhere other than `localhost:4000`, set
`VITE_API_URL` before starting the dev server, or edit the proxy target in
`vite.config.ts`.

Log in with any of the seeded demo accounts from the backend README
(Admin: 9922297341, Owner: 9000000001, Labour: 9000000101 — all
`Password123!`) and you'll land on that role's app automatically.

## PWA

`npm run build` produces an installable PWA (manifest + service worker via
`vite-plugin-pwa`). The service worker is deliberately configured to never
cache `/api/*` — offline-first for entries would mean Labour could "save"
an entry that silently never reaches the server, which is worse than
requiring a connection. Placeholder icons are in `public/icons/` — swap
these for real branding before shipping.

**Not yet implemented**: true offline entry queueing + background sync
(spec section 26's "Entry saved locally → Internet returns →
Automatically sync"). Right now, saving an entry while offline will fail
with a network error rather than queueing silently — building real offline
queueing correctly (with duplicate-submission protection once
connectivity returns) is substantial enough that it deserves its own pass
rather than being bolted on here.

## What's NOT yet built

- Automated tests (spec section 42) — everything above was verified by
  actually compiling and building it in this session, not by a test suite.
- Notifications (spec section 27).
- True offline sync (see above).
- Deployment configuration (spec section 30's cloud Postgres, hosting).
- Company/Labour "View" detail pages (edit exists via the list-level
  actions already built; dedicated single-entity detail screens are not
  in this pass).

## Design decisions worth knowing about

- **Color tokens** (`tailwind.config.js`) follow spec section 2 exactly:
  indigo/blue primary, green success, amber warning, red danger — with a
  `primary-800` (`#1e3a8a`) used for the sidebar branding mark specifically
  so Admin/Owner desktop screens read as "business tool" rather than
  reusing the same shade everywhere.
- **Dark mode** is wired via Tailwind's `class` strategy and used
  throughout every component, but there's no toggle button yet — add one
  that flips a `dark` class on `<html>` and persists the choice; the
  color work is already done, only the switch itself is missing.
- **The duplicate-entry warning** (spec section 22) is handled entirely
  inside `EntryForm`: a `409` from the backend renders inline with
  "Save Anyway" / "Cancel" rather than a native `confirm()`, since it
  needs to carry the specific duplicate warning text the backend returns.
