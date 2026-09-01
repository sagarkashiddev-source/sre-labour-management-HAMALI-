# Upgrade notes — multi-language + companies

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
