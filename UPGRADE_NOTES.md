# Upgrade notes — multi-language + companies

## 0. Sep 2026 hardening pass (12-item priority list)

Fixed, in order: (1) the `force` flag vs. hard duplicate-guard DB index
contradiction — replaced with an advisory-lock transaction so forced
same-day repeat entries (real in the data) actually work; (2) approved
entries are now locked for every role including Admin, with a new
Admin-only `PATCH /entries/:id/reopen` correction workflow (reason
required, fully audited) — surfaced in the Admin Entries UI as "Reopen for
Correction"; (3) a financial-data leak in the single-entry audit-history
endpoint that skipped the redaction `listAuditLogs` applied; (4) a
LabourProfile.id vs. User.id mix-up that silently broke the labour
report's "Work" column for every labourer; (5) removed the dead
`otherDeductionPct` field end-to-end rather than leaving it half-wired;
(6) one shared `PrismaClient` singleton (`src/lib/prisma.ts`) instead of
13 separate ones; (7) every DB update + its audit log now commits in one
transaction, across all controllers; (8) a real Vitest suite (44 passing
tests — jwt, password hashing, vehicle-number normalization, business-
timezone formatting, amount-in-words, RBAC gating/select-shape logic,
error handling, asyncHandler; `calculation.service.test.ts` needs a
generated Prisma client to run, see its own comment); (9) disabling the
last active Admin or your own account is now blocked; (10) removed the
hardcoded demo password from the production bootstrap path — see
`prisma/bootstrapAdmin.ts` and `DEPLOY_RAILWAY.md` §4; (11) three
composite DB indexes matching the app's actual query shapes; (12) a UI
pass fixing the Edit/Amount buttons that were still shown (and would
fail) on locked approved entries, plus the itemized monthly "Bill"
export (below) getting a real UI entry point on both the Admin and
Owner Reports pages.

**New in this pass: the itemized monthly Bill.** The two uploaded PDFs
turned out to be two *different* report types, not one. The per-day hamali
summary (Date/Amount/Deduction/Net/Present/Per-Person) already existed as
`generateMonthlyExcel`/`generateMonthlyPdf`. The itemized GST invoice
(SR.NO/DATE/VEHICLE.NO/TYPE/LOAD-UNLOAD/COMPANY/REMARK/AMOUNT, 18% GST,
amount spelled out in words, bank details) did not — added as
`computeMonthlyBillRows`/`computeMonthlyBillTotals` in `report.service.ts`,
`generateMonthlyBillExcel`/`generateMonthlyBillPdf` in `export.service.ts`,
a new `utils/numberToWords.ts` (Indian lakh/crore numbering, tested against
the real April bill's exact total: 320311 → "THREE LAKH TWENTY THOUSAND
THREE HUNDRED AND ELEVEN"), and `/reports/monthly-bill` + export routes.
GST rate (18%) is a bill-format constant, not a `CalculationRule` field —
it's unrelated to the per-entry company/labour deduction percentages.

What changed in this pass, and how to pick it up.

## 1. Multi-language support (English / Hindi / Marathi)

- `frontend/src/i18n/` — `react-i18next` setup + `locales/en.json`, `hi.json`, `mr.json`.
- A `LanguageSwitcher` pill (shows हिन्दी / मराठी / English in their own
  script) sits on: the Login screen, the Labour top bar (Home & Me tabs),
  and the bottom of the Owner/Admin sidebars.
- Choice is remembered in `localStorage` (`sre-language`) per device.
- Translated so far: Login, the whole Labour app (Home, Add/Edit Entry,
  History, Me, bottom nav), the shared work-entry form, and the Owner/Admin
  navigation + the Companies page. Deeper Admin screens (Reports, Audit
  Logs, Settings, User management) are still English-only — labourers are
  the primary non-English-speaking audience and were prioritized; extending
  the same `t('...')` pattern to the remaining admin pages is mechanical if
  you want full coverage later.
- Added Noto Sans Devanagari as a font fallback (`index.html` + `index.css`)
  so Hindi/Marathi actually render instead of showing tofu boxes.

## 2. Vehicle Number stays English-only, everywhere

Per spec: the Vehicle No. field's label, placeholder, and input in
`EntryForm.tsx` are hardcoded English text (never run through `t()`),
tagged `lang="en" dir="ltr"`, and pinned to the Latin font stack via the
`.field-vehicle-no` CSS rule in `index.css` — regardless of which language
the rest of the app is set to. The vehicle-number search box in Labour
History gets the same treatment.

## 3. Companies — cleaned from your workbooks + manual add

- `backend/prisma/companies.data.ts` — 145 canonical company names,
  extracted from the `COMPANY` column across every sheet in both
  `SR_HAMALI_2026-27.xlsx` and `VIJETA_2026-27.xlsx`, with ~224 raw
  spelling variants (GARRETT/GARRATT/GARRENT/CARRETT etc.) merged and
  junk rows (`****`, `10% DEDUCTION`, `TOTAL`, `PREVIOUS BILL 10%`) dropped.
- `prisma/seed.ts` now seeds this full list instead of the old 12-name
  sample. Re-running seed is safe (upsert by name).
- **For an existing database you don't want to fully re-seed:**
  `npm run import:companies` (backend) — only adds companies that don't
  already exist; never touches or deletes anything else.
- Admin's existing "+ Add Company" screen (Admin → Companies) is unchanged
  and still the way to add anything not on the list, or companies you take
  on later.
- This list is a starting point, not locked — expect some entries to need
  a rename/merge once you're looking at it day to day (a few clusters, like
  the `MAHALE` sub-lines, were merged into one name; split them back out in
  Admin → Companies if you bill those lines separately).

## 4. Labour can choose companies (nicer picker)

`EntryForm.tsx`'s company field already searched the same Companies list
used by Admin — it now also opens as a full-screen, tap-friendly bottom
sheet with big rows and live search on the Labour ("large") form, instead
of a small native `<select>`, which is easy to mis-tap on a phone.

## Verified in this session

- `cd frontend && npm install && npx tsc -b && npx vite build` — clean,
  real production build.
- `cd backend && npx tsc --noEmit` — same pre-existing gap as the original
  README already flagged (this sandbox can't reach Prisma's binary host to
  generate the Prisma Client, so `Prisma.Decimal`/`Role`/etc. show as
  unresolved). None of the errors touch the files changed in this pass
  (`seed.ts`, `companies.data.ts`, `importCompanies.ts`) — run
  `npm run prisma:generate` against a real network first, as the original
  README already said to.

## Not done in this pass

- Full translation coverage of the deeper Admin screens.
- Any change to the Owner/Admin dashboard, Entries, Reports, or Settings
  page layouts — "simple but effective" UI work concentrated on Login and
  the Labour app, since that's the app's highest-volume, most
  mobile-constrained surface.
